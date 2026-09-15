# Design decisions

Approved direction: `.impeccable.md`.

## Accepted tokens
- Editorial lobster scarlet, warm shell paper and ink/oxblood dark surfaces; perceptual OKLCH tokens.
- Fraunces for the wordmark/editorial headlines; Instrument Sans for compact workbench UI. Bundled font files only.
- Default light theme with persistent dark option. No forced animation.
- Photography in welcome/setup; original small letterform mascot in active transcripts. No photographs behind evidence.
- Desktop three-pane workbench. Mobile uses a navigation drawer and full-width inspector instead of squeezed columns.
- Brand scarlet is separate from operational warning plum/amber. Errors always carry icon/text, never color alone.

## Anti-patterns
No dashboard KPI grid, glassmorphism, glowing gradients, decorative charts, streaming fake inference, model-generated praise, automatic approval, or praise during errors/review.

## Primitives and provenance
`src/components/Primitives.tsx` is original MIT source, uses React Aria's Apache-2.0 Button, and includes original geometric SVG icons. No Untitled UI PRO source/components copied. Parent-supplied lobster images have their own provenance document under public/assets.

## Shipped review surfaces
Welcome, chat/excerpt preview, stage packet preview, revision checkpoint, context/export preview and connection boundary are implemented in this branch. They remain subject to independent review and a human smoke test.

## Hands-on first-use addition — September 15, 2026

The welcome screen offers “Try a guided example” beside direct demo exploration. A compact inline guide uses existing chat, context, run, inspector and checkpoint controls. It never overlays or disables the workbench. Show-panel buttons navigate only; stage advancement is derived from observed state. Skip is always available and replay retains earlier projects. No new tour dependency, backend route, approval authority, model call or live capability was added.

## Original Lobster sounds — September 15, 2026

Approved narrow amendment: local Web Audio shell taps, short scuttle, and a bubbly double whoop. No sampled character/actor audio, automatic speech, microphone, model calls, remote media or sound dependency. Controls live in a compact inline disclosure below the top bar on every screen, including mobile; no overlay or notification surface.

Off by default; explicit enable + Test sound activates this visit. Persist only the boolean and volume under `claw-chat.sounds.v1`. Returning from a hidden page also needs a fresh gesture. Cues last at most 0.58 seconds, share a 1.2-second cooldown and never overlap. Maximum master gain is 0.5 over sequential envelopes capped at 0.12; default slider is 35%. Dropped cues are never queued. This is an independent preference from the mascot.

Trigger only confirmed project/excerpt saves, acknowledged demo starts, and once-only returns of exact current-session task IDs. Silence approvals, messages, navigation, initial/history loads and guide milestones. Reviews/errors/unresolved work suppress celebratory cues. Mute/hidden/disposal immediately disconnect scheduled voices and invalidate pending activation/actions. Sound cannot stand in for visible state or grant permission.

Shipped source: `src/lib/lobsterSounds.ts`, `src/lib/useLobsterSounds.ts`, `src/components/SoundControls.tsx`. Prior art: MDN Web Audio gesture/mute/volume pattern; see the implementation plan. No paid-asset/licensing change. Preference and completion tracking are UI-only, with no backend, review-token or Gateway change.
