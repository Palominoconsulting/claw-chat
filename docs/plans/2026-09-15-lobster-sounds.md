# Original Lobster sounds — approved scope amendment

September 15, 2026. Add a small optional procedural sound pack to the existing lobster UI. This is decorative branding, never monitoring, correctness feedback or approval authority.

## Plan
1. Test a pure event policy: successful saves, acknowledged demo starts, and once-only completion of the exact tasks started in this browser session. Consume suppressed events; no historical replay. Global cooldown and one bounded cue at a time.
2. Test and implement `src/lib/lobsterSounds.ts`: original oscillator/filter/envelope recipes, gesture-only AudioContext creation/resume, conservative gain, immediate cancellation on mute/hidden/disposal, rejected/missing API isolation and async-resume race protection.
3. Add shared accessible inline controls (`src/components/SoundControls.tsx`) reachable from welcome, setup and workspace, including mobile. Off by default; persist only enabled/volume, require explicit sound activation after each reload. Test sound is a real gesture, never autoplay.
4. Wire only confirmed saves and starts in Chat/Runs and observed completion in App. No cue for approval, rendering, messages, errors, navigation or mascot appearance. Suppress completion in Decisions, launch preview, errors and failed/unknown/stale stages. Hidden/mute clears pending completion observations.
5. Add mocked lifecycle/policy tests and instrumented browser checks, run all checks, update design/spec/README. Draft PR into feature/mvp; no release or preview changes.

## Prior art
Follow MDN Web Audio best practices: create/resume within a user gesture and offer mute/volume controls. Use the platform API without a dependency or downloaded samples. References checked September 15, 2026:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume

## Second-order effects
The new versioned local preference controls audio only; no source text, review tokens, permissions, server schema or Gateway behavior enters it. Sound has no bearing on guide progress or gate eligibility. Completion means returned simulation, never verified findings. No audio samples, voice imitation, model calls, network media or paid assets. Silent failures remain fully usable. Context and pending cues are memory-only and disposable; no catch-up after a hidden page or mute. Browser audio availability and physical audibility are separate; automated tests instrument nodes, not human hearing.
