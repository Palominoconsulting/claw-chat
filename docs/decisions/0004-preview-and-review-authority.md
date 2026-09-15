# ADR 0004 — Snapshot-bound capture, launch admission and checkpoint review

Date: 2026-09-15
Status: Implemented for the synthetic MVP and independently reverified September 15, 2026. All four high and two medium targeted findings passed follow-up review, including an independent ancestor-invalidation reproduction. Human smoke-test acceptance remains separate. Live Gateway execution remains disabled.

## Reason

Independent review found that mutable history pages, implicit launch context, revision-only review, and immediate-predecessor checks could authorize content the operator had not actually reviewed. Approval and Start must be independent, explicit, compare-and-swap operations.

## Established patterns

Use optimistic concurrency (CAS), immutable server-held read snapshots, append-only audit events, and durable idempotency receipts. The SQLite `BEGIN IMMEDIATE` transaction is the admission serialization point. No live execution permission is added.

## Contracts

### Source capture

`GET /api/v1/history` returns an opaque `pageToken` bound to the server-held serialized page, including exact text, author, complete source namespace/session instance and stable message identity. Project creation and context capture require `{key, pageToken, messageIds}`. No submitted text or provenance is authoritative. Missing contracts fail 400; expired/evicted/mismatched candidates fail 409.

A browser session retains up to eight immutable pages, at most 2,000,000 serialized characters total, for ten minutes. One page is capped at 1,000,000 characters. Restart discards candidates; reload and preview again. Selecting/reconnecting invalidates candidates. Selection generations reject late A→B→A history responses. Concurrent same-selection reads retain independent candidates rather than replacing a shared page. Duplicate/missing/conflicting message identities are rejected in the adapter and duplicate/mismatched normalized identities are rejected by the HTTP boundary.

Chat retains the preview's page token and message copies together; later page/state updates cannot silently substitute their content. Selection IDs are scoped to the page token. Another tab can expire/invalidate a candidate, causing a visible conflict, but cannot substitute text.

### Start

`GET /api/v1/stages/:id/preview` returns the stage, context items/version, all ancestor approval references and a SHA-256 launch `token`. The token hashes stage ID/revision, task briefs, exact context digest/version, and all ancestor references. The browser retains this response unchanged until Cancel or Start. It never rebuilds the token from refreshed state while displaying an old packet.

`POST .../start` requires `{token}`. Inside the admission transaction, compare the contract and validate the entire ancestor chain before inserting snapshots/tasks. A stale token fails 409 before any dispatch scheduling. The accepted token is stored on the stage; an exact duplicate is a no-op receipt lookup, including after restart or subsequent edits, and schedules zero additional work. A different token cannot restart an admitted stage. Receipts are not a claim that the task completed.

### Review and revision

`POST .../review` requires `{revision, generation, requestId, action, note}`. `generation` is the displayed stage's monotonically increasing review generation, and `requestId` is a fresh UUID for that explicit review attempt. CAS, receipt lookup, full event append and state update happen in one transaction. An identical immediate retry is a no-op; an old receipt after a newer state transition fails 409 rather than overwriting that transition. Reuse with different content fails 409. A new terminal choice requires a fresh explicit review of the current generation. The component remounts its evidence confirmations, note and request ID when the generation changes.

`POST .../revise` also requires displayed `revision` and `generation`; stale proposal editors cannot overwrite newer decisions. Proposal edits and context changes advance review generation. Old execution snapshots are never recertified under edited context; create a fresh project for revised execution.

### Dependencies and history

Each admitted stage records references to **every** ancestor: stage ID, proposal revision, review generation, snapshot ID and proposal/dependency digest. Admission and review validate all of these references and the ancestors' own recorded dependencies, not only the nearest predecessor's status.

When a consumed checkpoint is revised or explicitly reviewed again, all existing descendants become permanently dependency-stale and lose approval authority. Running work is neither stopped nor silently rerun; its eventual output is retained but cannot be approved as current. Fresh stages added later still fail ancestor validation. Unconsumed drafts can use a newly reviewed parent because no dependent result has yet relied on the old choice. The MVP recovery path for consumed invalid dependencies is a new execution project, not retroactive blessing or an implicit rerun.

New append-only review events contain the complete checkpoint body (proposal, assumptions, missing evidence, alternatives, generation, dependencies), its SHA-256 digest, full evidence records and the immutable context snapshot. Revision records preserve both old and replacement checkpoints. Earlier events lacking these fields remain explicitly incomplete; migration does not invent their historical content. Export format 1 gains additive event/stage fields.

## Process ownership and migrations

Persistent `Store` acquires an exclusive `wx` owner lock on the canonical DB path **before** opening SQLite, chmod, PRAGMAs, migration, seed or recovery. A second owner cannot mutate the database. All constructor failures close the DB and release only the acquired lock; normal close is idempotent and checks lock inode/device before removal. No automatic stale-lock deletion or takeover exists. Hard links to a DB are unsupported; use its canonical path.

`startLocal` validates origin before opening the store and encloses app/listener initialization in cleanup, including bind failure. Index does not hold a second late lock. Tests use disposable stores/listeners and never alter real services.

Schema **004** adds authority fields to existing stage JSON. Pre-upgrade admitted stages are conservatively dependency-stale and old approvals lose authority because their admission receipts cannot be reconstructed. Their tasks, source snapshots and previous events remain available for inspection/export. Fresh draft projects remain usable. Back up the DB while stopped before upgrade. Offline production rollback requires the pre-upgrade backup plus its matching binary; the disposable-test down script changes version only and deliberately does not restore unverifiable approval authority. Old clients' missing concurrency parameters fail closed.

## Second-order effects

- **Sticky contract:** review generations, launch receipts and causal references now carry authority; future APIs must preserve them.
- **One-way historical limitation:** already overwritten pre-upgrade proposals cannot be recovered. Never backfill invented evidence.
- **Conservative tradeoff:** rereviewing even an unchanged consumed parent invalidates downstream work. This may require extra synthetic practice but prevents retroactive certification.
- In-memory source candidates are bounded and intentionally not durable; expiration affects convenience, not source integrity.
- This is trusted-host, single-operator admission control, not proof of human identity or a sandbox against a malicious local process. No real Gateway safety/certification claim is made.

## Verification

Regression suites cover exact competing-tab source capture, duplicate identities, delayed history responses and selection ABA, candidate expiry/eviction, stale launch/ancestor contracts, duplicate dispatch scheduling, rollback before dispatch, stale approvals and revisions, consumed/running descendants, complete history/export and receipt persistence, legacy migration, competing DB owners and failed startup cleanup. Browser regressions retain the visible capture/launch snapshot across another tab and an App state refresh. Run `npm run check`; browser authority suite uses `npx playwright test -c tests/authority-playwright.config.ts` on isolated port 4329 (no use of the main worker's 4318 listener).
