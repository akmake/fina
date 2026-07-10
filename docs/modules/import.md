> Last updated: 2026-07-05
> Status: Phase 2 (Import 2.0) — implemented

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
| `server/services/importScheduler.js` | In-process daily scheduler — enqueues due connections; started in `server.js` |
| `server/controllers/bankConnectionController.js` + `routes/bankConnectionRoutes.js` | CRUD + `sync` + job polling at `/api/connections` |
| `client/src/stores/connectionsStore.js` | Client store: list/create/delete/sync + job polling |
| `client/src/pages/BankConnectionsPage.jsx` | Manage connections, add (incl. One Zero OTP), sync now, toggle auto-sync. Routes: `/connections`, `/import/connections` |

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
`IMPORT_SCHEDULER_INTERVAL_MS` (default 30 min). Each tick finds connections that
are `autoSync && status:'active'` and due (`nextSyncAt <= now`), pushes
`nextSyncAt` forward **before** enqueuing (so overlapping ticks can't double-run),
and enqueues a `scheduled` ImportJob per connection. `runImportJob` is identical
to the manual path — so unattended results match user-triggered ones. Disabled
entirely (with a warning) if `FINA_ENCRYPTION_KEY` is unset.

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
flagged `needs_otp` for re-auth. `visaCal` uses a per-session browser OTP token
that can't be reused, so it is **excluded** from saved connections (stays on the
one-time `/import/auto` page).

---

## Gotchas

- Each scrape launches headless Chrome — heavy. `IMPORT_MAX_CONCURRENCY` (default 2)
  caps simultaneous runs across manual + scheduled.
- On serverless/short-lived hosts the fire-and-forget job may be killed
  mid-run; the scheduler is designed for a long-lived Node process (Render, VPS).
- Dedupe is by `(day, amount, description [+processedDate/installment])` plus the
  scraper `identifier` — matches the partial unique index on `Transaction`.
