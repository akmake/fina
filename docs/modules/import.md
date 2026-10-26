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

**OTP-request failures** (`calOtpRequestError` in `calService.js`): only a JSON
400/401/404 from CAL counts as "details not recognised" (credential error → connection
`status:'error'`). A 403/429 or a non-JSON (WAF/HTML) page means CAL blocked the
request — transient, message says so, connection stays active. The raw HTTP status +
body snippet are logged (`[cal] OTP request failed`). Open question: CAL may block
the VPS IP outright (the one-time import runs browser-side for that reason —
`client/src/utils/calDirectApi.js`); see `docs/known-unknowns.md`.

The dashboard ("what's new") and `/connections` show "waiting for SMS code" live
with the manual-entry box; both poll while a job is waiting.

## Phone OTP relay

The phone side is the **Relay app** (separate repo `GitHub/AppSms`, Android, Kotlin +
Compose), adapted to Fina in 2026-10. Production server: **https://ziporiteem.com**.

### How the app is wired to Fina

- **Fixed server.** The address is `BuildConfig.FINA_BASE_URL` (default
  `https://ziporiteem.com`, override with `-PFINA_BASE_URL=https://…`, https only). There is
  no editable address; an old stored one is deleted on start. Endpoints:
  `POST /api/devices/sms` and `POST /api/devices/heartbeat` (both **before CSRF**, Bearer auth).
- **Pairing.** Fina → `/connections` → "צימוד טלפון" shows a **QR** (`finasms://pair?token=fd_…`, returned as `qr` by `POST /api/devices`) that the app scans with Google's code scanner; the raw `fd_…` key is shown too as a fallback. The app
  **verifies it with a heartbeat before saving** (so "connected" means Fina accepted it;
  wrong key / no network show a clear message).
- **Only CAL codes leave the phone.** `SmsFilter` (same pattern as the server's `CAL_SMS`):
  sender/body matches CAL (the real sender is **CalLogin**; also Visa Cal, cal-online, whole-word כאל/ויזה with one prefix letter —
  not "כאלה") **and** the body has a standalone 4-8 digit code. Everything else stays local.
- **Delivery.** The SMS broadcast (`goAsync`) records the message in a durable ledger, enqueues
  an expedited WorkManager job (safety net: survives process death / Doze / no network;
  `getForegroundInfo` implemented for Android 8-11), and tries immediately (7 s). A ledger
  **claim** makes receiver and worker never send the same message twice. Retries use backoff
  (10 s, 20 s, 40 s …) until the code's lifetime ends (12 min), then the message is marked
  expired. 2xx = done even if "nothing was waiting"; 401/403 = key revoked → the app shows
  "re-pair"; 425/429/5xx/network = retry.
- **Heartbeat** every 15 min (+ on open / after pairing): refreshes "last seen" on Fina and
  detects a revoked key. The app shows a health card: connection, SMS permission, battery
  optimization (with a button), last code and its result, pending count.

### Server behaviour for the Relay app (`relaySmsInbound`)

`POST /api/devices/sms { id, from, body, receivedAt, platform }` with `Authorization: Bearer fd_…`:

| Response | Meaning |
|----------|---------|
| `200 { handled:true, accepted:true }` | A sync was waiting; the code is accepted and the sync finishes **in the background** (acknowledged at once — fetching transactions can outlast the phone's HTTP timeout) |
| `200 { handled:false, reason }` | `not-a-cal-sms` · `no-code` · `no-sync-waiting` (nothing to do — not an error) |
| `425 { retry:true, reason:'sync-starting' }` | The SMS **beat the server** (the sync has begun but has not yet saved "waiting for code"). The phone retries in ~10 s. Only returned while such a sync started < 2 min ago |
| `401` | Unknown / revoked key |
| `429` | Rate limit (`deviceLimiter`, 30/hour per key in production) |

`POST /api/devices/heartbeat` → `200 { ok, awaitingOtp, deviceName, serverTime }`.

### Generic contract (any other client)

1. **Pairing** — `POST /api/devices` (session) returns a one-time token `fd_…`.
2. **Auth** — `Authorization: Device <token>` **or** `Bearer <token>`.
3. **`POST /devices/otp { code | message, sender }`** — needs the `X-Fina-Client` header (global
   CSRF). `200 { matched, status, stats }` (waits for the whole sync) · `404 { matched:false }` ·
   `422` wrong code (sync keeps waiting) · `429` too many wrong codes / rate limit · `410` expired ·
   `401` unknown/revoked token.
4. **Scope** — a device token can only call the phone endpoints (`/sms`, `/heartbeat`, `/otp`);
   it can't read any data. Every relayed SMS counts as a code attempt at CAL, so clients must
   filter by sender (the server also refuses anything that doesn't look like CAL).

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
  A stored **pending** row is superseded (soft-deleted, replaced) when its completed
  version arrives — matched by `identifier` or by deal key `(day, description,
  original amount+currency for foreign deals / amount otherwise)`; an incoming pending
  row matching any stored deal key is skipped (its estimated amount drifts daily).

### Foreign-currency deals

Card companies send a foreign purchase with its original amount/currency, but the ILS
charge is `0` while pending (Max, Isracard/Amex), equals the original-currency amount
(CAL pending), or is billed in USD/EUR (`chargedCurrency`). `parseTransactions`
(`utils/excelParser.js` → `estimateForeignAmount`) converts these at the day's rate from
`services/fxService.js` (exchangerate-api, 6h cache, built-in fallback rates when
offline) and stamps `amountEstimated: true` + `fxRate`. A row with a real ILS charge is
left as-is. The UI shows `≈` and the original amount (`TransactionCard`). The real
charge replaces the estimate via the pending-supersede rule above.
