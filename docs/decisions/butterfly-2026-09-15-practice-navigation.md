# Second-order check: practice navigation repairs

Scope: `feat/lobster-sounds..fix/inspect-navigation`. Product references: `docs/specs/2026-09-14-v1-design.md`, the immutable authority boundary in ADR 0004, and `.impeccable.md` principles 1 (readable evidence), 2 (separate encouragement/status/approval), 3 (compact workspace), and 5 (warnings take priority).

**Verdict: three two-way decisions; no sticky or one-way decisions and no product-direction conflict found. Ready for independent draft review after green checks. No merge or release performed.**

## Decisions and downstream effects

1. **Navigable, dismissible inspector with a mobile keyboard boundary.** Chosen over a close-only pane or a second tour overlay. At six and twenty-four months, users and this repo's browser tests rely on the controls; no outside data consumer gains a contract. Removing or revising the UI costs an ordinary frontend patch with no data migration. Moving from result to result stays within the selected project's inspected stage; reaching Decisions never grants authority. This supports principles 1 and 3.
2. **Latest-request-only snapshot observation, independent of write admission.** Chosen over routing a read through the mutation busy flag. Future read consumers must continue to associate the response with the requested immutable snapshot, rather than treat any successful HTTP response as evidence for any task. Only this client uses the observation list, which disappears with the visit. Reversible in a day with all records intact. The immutable IDs, approval CAS and explicit Start boundaries remain unchanged, supporting principles 1, 2 and 5.
3. **Reveal/focus for inline stage creation and launch preview; guide shares evidence scrolling.** Chosen over toggling an offscreen form or duplicating Create/Start controls into the guide. In six and twenty-four months, the only dependencies are human navigation and these UI tests. It costs a small frontend change to revise; the stored stages and review history are unaffected. Showing a form cannot create work, and showing a packet cannot start it. This supports principles 1 and 3.

## Open questions

No product question was silently resolved. The parent explicitly extended this bug-fix scope to the separately reported Add-stage dead end. The full-width mobile inspector already existed; this patch makes it operable. Live execution and compatibility remain outside scope.

## Category scan

- **Data model:** no schema or persistent observation field; no source/snapshot/event rewrite.
- **Interfaces/contracts:** no route, payload, export, token or config changes; controls are UI-only.
- **Permissions/data boundaries:** same existing snapshot read path; task/stage/project identity checked before observation. No new data source or principal.
- **Agent/automation:** no model calls, automatic approval, dispatch, retries, or background work. Retry is a user action.
- **Time/money semantics:** none changed.
- **Operations:** no service, port, key, scheduler or vendor added. Only the existing isolated synthetic test server was used; deployment remains with the parent.
- **Cost curves:** one GET per explicit inspection/retry, no polling added. In-memory opened task IDs grow with visited results during the current page session; no source text is copied or persisted. At larger visit counts this small local list can be replaced without changing stored data.
- **Vendor/lock-in:** no package or paid asset added; native browser focus/inert behavior plus existing React Aria buttons.
- **Removed behavior:** the close glyph remains compatible. Inspector reads no longer enter `mutate`, which previously serialized the read with writes and could leave Loading stranded. Add no longer toggles closed; explicit Cancel retains dismissal. The guide remains inline, now inside the workspace scroller so it cannot squeeze controls out of short viewports.
- **Test/deploy:** normal pointer actions, synthetic data, controlled response barriers and real-state completion waits. No forced clicks, fixed delays, staging data or authority changes. Rebuild frontend and matched local server; no migration or native rebuild.
- **Documentation:** ADR 0005 and design decisions describe actual navigation, read-failure behavior, observation semantics and deployment requirements.

## Not judged

Physical iOS/Safari scrolling, screen-reader announcements and touch keyboard behavior still need a human device smoke test. Browser tests cover Chromium at both requested mobile sizes and desktop. No live Gateway compatibility or real-result correctness claim is made.
