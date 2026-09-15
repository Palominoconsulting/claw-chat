# Second-order check: original Lobster sounds

Scope: `feature/mvp..feat/lobster-sounds`. Product reference: `docs/specs/2026-09-14-v1-design.md` and `.impeccable.md`, especially principles 2 (encouragement is separate from verified status/approval), 4 (optional local delight) and 5 (warnings/review take priority).

**Verdict: 3 decisions, all two-way doors. No sticky or one-way decisions; no conflict with the product direction found. Suitable for a draft review PR after checks. Independent review and a human listening check remain necessary before release.**

## Decisions and consequences

- **Procedural platform audio instead of recorded clips or a library.** Browser clients depend on Web Audio availability; absent/rejected APIs leave the app quiet. At six or twenty-four months, only the frontend should depend on these private recipes. Replacing or removing them costs an ordinary UI patch, with no data loss or vendor migration. No audio fingerprint, microphone, model, media download or permission request is introduced.
- **Separate, versioned, off-by-default browser preference.** Only this origin's UI reads `claw-chat.sounds.v1`; it stores an enable boolean and volume, never task/source content. A future preference change may require a tiny parser migration or a conservative reset to off. It cannot restore gesture authorization, alter review records or enable another capability. At six or twenty-four months the only durable consumer is this browser preference, so removal retains all project data.
- **Observe confirmed actions and exact current-session demo tasks.** The cue selection consumes real action/stage IDs in memory only, with bounded sets, a shared cooldown and no playback queue. Future live execution must not casually inherit demo completion sounds: live results may be ambiguous, and this observer explicitly accepts demo state only. The implementation can be removed within a day without touching launch/approval authority. Completed remains a simulation return, never a correctness score.

## Open questions / removed behavior

No product open question was silently resolved. The owner-approved sound amendment explicitly narrows the previous no-audio sentence. That prohibition prevented surprise/noisy encouragement; default silence, gesture activation, immediate mute, quiet reviews, no mascot cues and no catch-up retain its purpose. The spec, design context and README now agree.

## Categories checked

- Data model: no server/schema/export changes; audio preference is UI-only.
- Interfaces/contracts: one documented versioned local preference; no routes, payloads, public package API or environment variables.
- Permissions/data boundaries: none added; no source text in preference, logs or audio synthesis.
- Agent/automation surface: none added; no automatic start, approval, speech or notifications.
- Period/time/money semantics: none changed. The sound cooldown uses the browser's monotonic clock.
- Operational burden: no new service, port, credential, dependency or scheduler. Audio failure is isolated.
- Cost curves: no new polling or network activity. One cue at a time, at most four scheduled voices, at most 0.58 seconds; bounded in-memory identity sets fail quiet when full.
- Vendor/lock-in: no new vendor or paid asset. Original source remains under the repository license.
- Tests/deploy: synthetic database/browser fixture on the existing test port; real audio-node instrumentation plus mocked lifecycle tests. No live Gateway, shared preview, service or runtime configuration changes. A frontend build/deploy is required; no migration/backend change.
- Documentation debt: amended spec/design/README and implementation plan included.

## Not judged

Automated tests verify gestures, scheduling, cancellation, recipes and UI behavior. They cannot establish how loud or pleasant the pack is on an operator's speakers/headphones or certify mobile Safari/OS audio behavior. The owner can use Test sound at a low volume; unsupported audio remains optional and quiet.
