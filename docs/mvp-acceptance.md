# MVP verification and explicit V1 gaps

This is a runnable MVP for review. It is **not** a full V1 release or a claim of live Gateway compatibility. The implementation follows the approved standalone/stage-only specification. No live Gateway, private configuration, credential store or private transcript was accessed. Independent source/security review and follow-up verification have been completed for the corrected checkpoint contracts. Human smoke testing is in progress on a private demo preview; this is not release authorization.

## Verified locally

- Real Node 26.5.0 service + SQLite persistence; React/Vite production build served same-origin from loopback.
- Synthetic chat composition is visibly deterministic. Conversations have nested source-reported/incomplete example lineage.
- Exact viewed message selection → preview → create/add project, context kinds, original source/hash, editable interpretation, promotion/archive, restart and opt-in JSON export.
- One to four parallel demo tasks per stage. Transactional launch admission and immutable snapshots. Separate task/run/session/idempotency identifiers.
- Zero successor tasks before **both** current-revision approval and separate Start. Double starts do not duplicate tasks. Missing/failed/unknown work cannot be approved.
- Proposal revision invalidates earlier approval. Context changes preserve snapshots and block stale certification. Review events and snapshots have SQLite immutability triggers.
- Restart marks interrupted tasks unknown without retry. Explicit demo reconciliation abandons them as failed, never as success.
- Exact Host/Origin, versioned `/api/v1`, same-origin cookie/CSRF, bounded JSON, literal escaped transcripts, recognized-secret refusal and project-scoped export allowlist.
- Actual public Gateway client connected to a synthetic WebSocket protocol server with challenge-bound device proof and read scope; selected-session history filtering works. This is a protocol fixture, not a real Gateway.
- Optional, skippable/replayable guided example uses existing demo controls and observed state, including real result inspection and separate successor start. No hidden approvals, dispatch or live/model calls.
- Light/dark/responsive workbench, keyboard controls and reduced motion. Mascot timing/opt-out/dismissal are local; suppressed during errors or stage review. It reserves footer space rather than covering work.
- Browser fixture with 10,000 synthetic messages renders at most 50 at once.

Current integration verification (September 15, 2026): `npm run check` passed typecheck, lint, **66 unit/integration tests across 9 suites**, and the production build. `npm run test:e2e` passed **12 browser tests**, including exact source capture, immutable launch previews, guided practice, full checkpoint handoff, large-history bounds, mobile behavior, and local assets/CSP. A separate read-only reviewer ran 18 focused authority/source/startup tests and independently reproduced the fixed ancestor-invalidation scenario without finding a remaining high-priority blocker in those contracts. The obsolete parallel guide prototype was archived outside the repository rather than shipped; the canonical implementation is `GuidedDemo` / `guidedDemo.ts`.

The initial baseline passed fresh-archive installation/build checks and a runtime dependency audit with no reported vulnerabilities; those results do not certify future dependency updates. Generated lobster assets are now tracked in the repository. Final branch CI and human smoke remain separate checks. Tailwind source scanning is restricted to application source rather than ambient workspace files. No secret scanner can prove arbitrary prose contains no secret; source/fixture review is also required.

The first shared preview exposed a deployment-version mismatch: a running backend served frontend files replaced by a concurrent build. The source-preview token was missing, disabling excerpt preview. The corrected preview runs from a matched immutable build snapshot with a separate persistent database. An isolated API smoke test verified selection → immutable excerpt preview → project creation with exact-content preservation. Do not rebuild into the directory serving an active preview.

## Deferred or unverified (do not market as shipped V1)

1. **Real pairing/compatibility:** no real Gateway tested. Only the 2026.8.1 read-only candidate is attempted. Unexpected version/scopes/history fail closed.
2. **Live execution/write upgrade:** no live send/dispatch endpoint; no write scope requested. Fresh sessions, authoritative descendant completion and lost-ack reconciliation against a real fixture remain release blockers.
3. **Durable pairing:** identity/tokens are memory-only; restart means new normal pairing. No keychain integration yet.
4. **Large runtime index/trees:** first 100 live summaries only; no 1,000-summary pagination, 100-node graph performance certification, event subscriptions/replay or full native tool inspector. All live lineage is conservatively incomplete.
5. **Revision UX:** stale launched context or rejected execution requires a fresh project for replacement work. Proposal-only edits can be reviewed at a new revision; no old work is silently re-run or re-certified. One stage runs globally at a time.
6. **Deletion/import:** archive/restore/export exist; project deletion and arbitrary bundle import do not. No secure-erasure claims.
7. **Crash owner lock:** hard crashes can leave a lock file; operator verifies no owner before removing it. No automatic lock takeover or blind re-dispatch.
8. **Distribution:** no release, merge or npm publication. A private synthetic preview is available for human review; generated artwork is tracked. Screenshots use synthetic data only. This is not a public live-agent deployment.
9. **Remaining checks:** final branch CI and human smoke-test acceptance must be recorded before publishing a release. The six targeted review findings were independently rechecked after correction; that focused review is not an audit of real Gateway execution.

## Deploy requirements for the draft PR

- Local service/frontend rebuild: **yes** (`npm run build`).
- Local SQLite schema migration: **yes**, forward versions 001–004 apply transactionally on start; rollback scripts are disposable-test/operator-only and never automatic.
- Remote backend deploy: **no**. Native app rebuild: **no**. Network/Gateway configuration changes: **none**.
