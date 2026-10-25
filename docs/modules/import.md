> Last updated: 2026-10-25
> Status: Phase 2 (Import 2.0) — implemented · 2026-10: daily sync hour, retry/backoff, CAL auto-sync via phone SMS relay

# Module: Import 2.0 — Saved Bank Connections & Unattended Sync

Lets a user connect a bank / credit-card provider **once** and have Fina sync
transactions automatically every day, with no browser session open. This is the
Phase 2 deliverable from [product-spec-v2 §11](../product-spec-v2.md).

Related canonical docs (do not duplicate): [database.md](../database.md) (schemas),
[api-reference.md](../api-reference.md) (routes), [architecture.md](../architecture.md)
(env vars), [bank-scraper.md](bank-scraper.md) (scraper internals).

---

## Pieces

| File | Role |
|------|------|
| `server/utils/crypto.js` | AES-256-GCM encrypt/decrypt for credentials (`FINA_ENCRYPTION_KEY`) |
| `server/models/BankConnection.js` | Saved connection: encrypted creds + sync state; soft delete; secrets `select:false` + stripped from JSON |
| `server/models/ImportJob.js` | One sync execution — status/stats the client polls; TTL 90 days |
| `server/services/scrapeService.js` | The **shared** scraper core (COMPANY_CONFIG, `runScrape`, One Zero OTP helpers). Used by both the HTTP route and the job runner |
| `server/services/transactionPersistence.js` | Shared persistence: apply category rules → dedupe → insert → refresh balances |
| `server/services/importRunner.js` | Runs one ImportJob end-to-end (decrypt → scrape → persist → update status); concurrency-limited |
| `server/services/importScheduler.js` | In-process daily scheduler — enqueues due connections at their Israel-local `syncHour`, expires unanswered CAL code waits; started in `server.js` |
| `server/services/calService.js` | CAL direct-API client (request/verify SMS code, fetch cards + transactions + pending, rows for `parseTransactions`) |
| `server/models/Device.js` + `middlewares/deviceAuth.js` + `controllers/deviceController.js` + `routes/deviceRoutes.js` | Paired phones relaying SMS codes (`/api/devices`) |
| `server/utils/israelTime.js` | Israel wall-clock helpers (next daily slot, month boundaries) |
| `server/controllers/bankConnectionController.js` + `routes/bankConnectionRoutes.js` | CRUD + `sync` + job polling at `/api/connections` |
| `client/src/stores/connectionsStore.js` | Client store: list/create/delete/sync + job polling (follows `awaiting_otp` jobs up to ~11 min), web OTP submit, paired devices |
| `client/src/pages/BankConnectionsPage.jsx` | Manage connections, add (incl. One Zero OTP, `calAuto`), daily sync hour, sync now, toggle auto-sync, "waiting for SMS code" box, phone pairing panel. Routes: `/connections`, `/import/connections` |
| `client/src/components/dashboard/UpdatesBrief.jsx` | Dashboard "what's new" brief (GET `/api/dashboard/updates`) — live connection state incl. waiting-for-code |

---

## Flow — manual "sync now"

```
POST /api/connections/:id/sync
  → controller.syncConnection → enqueueImportJob(conn, 'manual')
      → ImportJob {status:'queued'} created, runImportJob(jobId) fired (not awaited)
      → 202 { jobId } returned immediately
runImportJob (background):
  status=running → load conn (+secrets) → decrypt creds
    → scrapeService.runScrape / scrapeOneZeroWithToken
    → transactionPersistence.persistTransactions
    → job {status:'success', stats}, conn {lastSyncAt, lastSyncStatus, status:'active'}
  (on error) job {status:'error', error}, conn {status:'error'|'needs_otp', lastError}
Client polls GET /api/connections/jobs/:id until terminal.
```

## Flow — unattended daily sync (Phase 2 completion criterion)

`startImportScheduler()` (in `server.js`) runs a timer every
`IMPORT_SCHEDULER_INTERVAL_MS` (default 5 min). Each tick:
1. expires CAL jobs whose SMS code never arrived (`expireStaleOtpJobs`);
2. finds connections that are `autoSync && status:'active'` and due
   (`nextSyncAt <= now`) **and owned by an active user** (approved, not deleted);
3. pushes `nextSyncAt` to the connection's next daily slot **before** enqueuing
   (so overlapping ticks can't double-run) and enqueues a `scheduled` ImportJob.

**Daily slot:** every connection syncs once a day at its own `syncHour` (0-23,
**Israel time**, DST-safe — `utils/israelTime.js`), chosen in the UI. `runImportJob`
is identical to the manual path. Disabled entirely (with a warning) if
`FINA_ENCRYPTION_KEY` is unset.

**Scrape window:** from `lastSuccessAt − 7 days` (covers downtime gaps and
late-posting charges; capped at 1 year), else the provider default.

**Failure policy** (`markFailure` in `importRunner.js`):

| Failure | Connection | Next attempt | Owner notified |
|---------|-----------|--------------|----------------|
| Credentials (HTTP 400/401: wrong / must-change password) | `status:'error'` (stops) | after the user fixes it | yes, at once |
| One Zero token expired | `status:'needs_otp'` | after re-auth | yes |
| Transient (timeout, 5xx, site down) — scheduled | stays `active` | +30 min, +2 h, +6 h, then the daily slot | after the 3rd failure in a row |
| CAL code never arrived / transient | stays `active` | next daily slot (each attempt sends an SMS) | yes |
| Manual sync | status unchanged unless credentials | — | no (the user sees the result) |

Success resets `consecutiveFailures` and returns the connection to its daily slot.

**Dedupe:** in unattended sync (`includeDeleted: true`) soft-deleted transactions count
as existing — a row the user deleted never comes back on the next sync. Manual imports
keep the old behavior so "delete all → re-import the file" still works.
**Scheduler safety:** the slot is reserved atomically (`findOneAndUpdate` on the previous
`nextSyncAt`); a connection with a job already queued/running/waiting is skipped; jobs
stuck in queued/running for 45 min (process restart) are closed by the tick.
**Single-flight:** `POST /:id/sync` returns `409 { jobId }` while a job for that
connection is queued/running/awaiting a code (prevents parallel bank logins and a
second CAL SMS).

## CAL auto-sync (`calAuto`) — SMS code relayed by the phone

CAL logs in with ID + last-4 + an SMS code on **every** login, so it can't use the
headless scraper. `calAuto` (COMPANY_CONFIG, `deviceOtp: true`) uses CAL's direct
API (`services/calService.js`, shared with the one-time `/api/cal/*` import):

```
scheduler / "sync now"
  → runImportJob: requestCalOtp(id, last4) → CAL sends SMS
  → job { status:'awaiting_otp', otpExpiresAt: +10 min, maskedPhone, otpSession(enc) }
      (no Chrome → no concurrency slot held while waiting)
phone app receives the SMS → POST /api/devices/otp { message }      ← normal path
   or the user types it   → POST /api/connections/jobs/:id/otp { code } ← web fallback
  → submitJobOtp: atomic claim (awaiting_otp→running) → verifyCalOtp → fetchCalAccounts
  → parseTransactions('cal') → persistTransactions → success
wrong code → 422 (code OTP_INVALID), job goes back to awaiting_otp until it
  expires; the 3rd wrong code fails the job (429) so CAL never locks the account
no code in 10 min → scheduler tick marks it error (transient) + notifies the owner
```

The dashboard ("what's new") and `/connections` show "waiting for SMS code" live
with the manual-entry box; both poll while a job is waiting.

## Phone OTP relay

Contract for the Android companion app (the app lives in a separate repo):

1. **Pairing** — the user taps "צימוד טלפון" on `/connections` → `POST /api/devices`
   returns a one-time token `fd_…` (shown once). The user enters it in the app.
   The app stores it in encrypted storage (Android Keystore / EncryptedSharedPreferences).
2. **Every request** sends `Authorization: Device <token>` and `X-Fina-Client: web-app`
   (global CSRF header), JSON body, to `<API_BASE>/devices/...`.
3. **Heartbeat** (optional, e.g. every 15 min via WorkManager):
   `POST /devices/heartbeat` → `{ ok, awaitingOtp }`. `lastSeenAt` is shown on the web.
4. **SMS** — on an incoming SMS from CAL (sender filter in the app), send the whole
   text: `POST /devices/otp { message: "<sms body>", sender: "<address>" }`.
   The server extracts the 4-8 digit code. Responses:
   `200 { matched:true, status:'success', stats }` · `404 { matched:false }` (no sync
   waiting — ignore) · `422` wrong code (sync keeps waiting) · `429` too many wrong
   codes / rate limit · `410` expired · `401` = unknown/revoked token → ask to re-pair.
   **Filter by sender in the app** (CAL only): every relayed SMS counts as a code attempt.
5. **Scope** — the token can only do (3) and (4). It can't read any data.
   Rate limit: `deviceLimiter` (30/hour per device token, production) on both phone endpoints.

---

## Security

- **Credentials** (and the One Zero long-term token) are AES-256-GCM blobs
  (`v1:iv:tag:ciphertext`). The key is `FINA_ENCRYPTION_KEY` (64 hex chars).
- They are `select:false` **and** deleted by the model's `toJSON`/`toObject`
  transform — API responses are metadata-only. Decryption happens only inside
  `importRunner`, server-side.
- All endpoints are behind `requireAuth` + `familyScope`; writes are blocked for
  `viewer` members. Isolation flows through the `user` field via `scopeFilter`.
- Every create/update/delete/sync calls `audit()`.

## One Zero (OTP)

One Zero needs an SMS OTP. The add flow calls the existing
`/api/scrape/onezero/otp/start` + `/verify`; `verify` returns a reusable
`otpLongTermToken`, which the connection stores (encrypted) so future auto-syncs
skip the SMS step. If the token expires, the job fails and the connection is
flagged `needs_otp` for re-auth. The scraper-based `visaCal` uses a per-session
browser OTP token that can't be reused, so it is **excluded** from saved
connections; CAL auto-sync is offered as `calAuto` (see above).

---

## Gotchas

- Each scrape launches headless Chrome — heavy. `IMPORT_MAX_CONCURRENCY` (default 2)
  caps simultaneous runs across manual + scheduled.
- On serverless/short-lived hosts the fire-and-forget job may be killed
  mid-run; the scheduler is designed for a long-lived Node process (Render, VPS).
- Dedupe is by `(day, amount, description [+processedDate/installment])` plus the
  scraper `identifier` — matches the partial unique index on `Transaction`.
