# ADR 0005 — Reachable result and stage-form navigation

Date: 2026-09-15
Status: Implemented for draft review; no release or live-service change.
Scope: Owner-reported Inspect dead end, missing required-review-field indicators, and the follow-up report that “+ Add stage” appeared to do nothing. Fixes the approved practice workflow; no new workflow authority.

## Reproduction

Before the inspector fix, real synthetic practice at **390×844 and 320×568** reached the initial stage's first completed result. A normal Playwright pointer click on the second task's existing `Inspect` button timed out. The trace identified the full-width `aside.inspector` output as intercepting pointer events. Desktop tests had never covered this route. The only exit was the small close glyph, and the pane offered no onward navigation.

The follow-up Add-stage regression reached the approved checkpoint on a 390×844 viewport, chose `+ Add stage`, and failed the new focus assertion: `Stage title` remained inactive. The old handler toggled the form at the bottom of all stage rows without revealing it; repeating Add could close it. The final tests assert viewport position and focus **before** filling the field, so Playwright's autofill scrolling cannot conceal this problem.

## Established patterns and decision

Use a dismissible master/detail inspector, explicit previous-list/next-result navigation, request-generation guards for asynchronous reads, and focus/reveal for inline forms. Retain the existing desktop pane and actual task list. Avoid a second set of task data or cloned review/Start controls.

- The inspector has `Back to tasks`, `Result N of M`, and `Next result`. It prefers the next unopened completed result in the same inspected stage and selected project. After all of that stage's result snapshots have opened successfully, `Review checkpoint` closes the pane and reveals Decisions. None of these buttons approves or dispatches.
- The guide names actual outputs still awaiting inspection. “Opened” is an in-memory UI observation; it does not prove the operator read the output, certify correctness, or update the runtime task status.
- Snapshot reads run independently of the write-admission busy flag. Only the latest still-open request can populate the pane or update observation. Snapshot ID and project ID must match the selected task/stage. Close, scope change, message inspection, or another task selection invalidates older responses.
- Read failure stays inside the pane with Retry and Back. A full-width mobile pane also exposes any otherwise obscured global error. Local read errors retain the existing error-priority suppression for optional sounds and encouragement.
- Navigation is sticky while evidence scrolls, with at least 44-pixel inspector controls and viewport safe-area allowances. On small screens the existing full-width pane is a labelled keyboard-contained dialog, with the covered workspace inert. Escape and close restore focus; Back reveals tasks; Review focuses the Decisions heading. Desktop remains a nonmodal pane.
- The guide shares the workspace's scroll area with its real controls. Long instructions/progress cannot shrink the task area out of reach at short viewport heights.
- `+ Add stage` always opens/reveals the same draft and focuses `Stage title`. It never toggles closed. `Cancel stage` is explicit and returns focus to Add. Opening, re-opening, and cancelling do not save anything. After an explicit successful Create, reveal the new stage's existing preview button. Opening a launch preview reveals its heading. Packet confirmation and Start remain separate, explicit actions.

## Required review inputs

The required Review note previously had neither a visible marker nor accessible required semantics. The review buttons became enabled only after all evidence confirmations and nonblank note text, with no explanation of which prerequisite was missing. A regression test reproduced the missing `aria-required` state before this correction.

Review note now displays an asterisk, required/aria-required semantics, and help text explaining that the note is needed for all three review actions. Evidence acknowledgements are also marked required. A visible, polite status beside the action group lists only unmet prerequisites: unexamined outputs, blank/whitespace note, unsaved proposal edits, incomplete results, stale context/dependencies, or an archived project. Ready text presents Approve, Request changes, and Reject neutrally. The existing readiness expression, server validation, CAS tokens, and authority rules are unchanged. The guide also calls out the required note.

## Alternatives rejected

A more prominent close button alone still requires users to rediscover the obscured task list and guide after each result. Automatically advancing to Decisions would skip a result if a read failed or remained pending. Automatically starting after Create or approval would violate the existing authority boundary. A tour overlay would worsen the same occlusion issue.

## Consequences and reversibility

Two-way UI decisions, removable in an ordinary frontend patch with all data intact. No package, backend route, schema, export, token, CAS, review event, or persistent task state changed. The sound pack and its preference/gesture contract are preserved. There is one snapshot request per explicit inspection/retry; no new polling.

Deploy a rebuilt frontend with its **matched local server build** from this branch, following the existing snapshot deployment procedure. The server implementation and schema are unchanged. No migration, native-app build, Gateway/Tailscale change, or live chat access is required. This branch does not perform that deployment.

## Verification

- Baseline: 89 unit tests and 21 browser tests. Final suite adds one observation-progress unit test and ten browser regressions (90 unit/integration tests and 31 browser tests total).
- Full guided flow at 390×844 and 320×568: both actual results, visible Decisions, unchecked evidence confirmations, manual approval, Add/re-Add/Cancel/reopen, focused visible form, Create, visible preview, and separate Start.
- Normal pointer actions only. Close/Back/Escape, keyboard containment/restoration, and small-height evidence scrolling are exercised. No forced clicks.
- Snapshot 503/Retry, mismatched snapshot rejection, delayed task-switch response, close during a pending read, and inspection during an unrelated save's pending refresh.
- Required review-note/evidence semantics and visible missing-prerequisite explanations are exercised; whitespace does not enable any review action, and unsaved proposal edits remain blocking.
- Ordinary desktop inspection stays nonmodal and navigation leaves persisted tasks/stages/events/projects unchanged. Existing desktop workflow, sound, security, and authority regressions remain in the full suite.
- Shared synthetic fixtures wait for their own successor to finish before the next test; this avoids mistaking the existing account-wide active-stage gate for an inspector failure. No fixed sleep or weakened admission rule was added.

Commands: `npm run check` and `npm run test:e2e` on the existing isolated 4318 fixture. Automated Chromium viewport checks are not a certification of physical iOS/Safari behavior; independent owner smoke testing remains appropriate.
