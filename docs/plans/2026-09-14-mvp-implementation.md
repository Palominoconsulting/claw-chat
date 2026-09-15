# MVP implementation plan

## Goal
Deliver a runnable, local-only review workbench with persistent synthetic chat → curated project → bounded stages → versioned review → separate next-stage start. The approved V1 spec is the product contract; this MVP must label unverified live integration and remaining release acceptance gaps.

## Architecture and stack
Node 26.5+ TypeScript service; built-in SQLite, React/Vite/Tailwind 4. One HTTP origin and loopback listener, default port 4317. Exact APP_ORIGIN, host allowlist, SameSite/HttpOnly session cookie and per-process in-memory CSRF tokens; no Gateway credentials in browser/storage/logs. Production serves built frontend assets. Development builds frontend then serves it on the same origin (no separate Vite trust bypass).

SQLite holds normalized projects, context items, stages, tasks, immutable snapshots, review events and synthetic messages. A synchronous transaction claims a stage before dispatch. A single process owns admission; unfinished intents become unknown on restart and never auto-dispatch. Fixed stage ordering, maximum four independent tasks per stage. Native descendant control is explicitly out of scope.

Gateway boundary: npm availability verified for exact @openclaw/gateway-client and gateway-protocol 2026.8.1. Use public typed client with explicit in-memory server-supplied bootstrap secret and challenge-bound device proof. Begin read-only, no impersonation/admin/auto-pair. Live managed execution remains disabled unless its full lifecycle can be verified. Demo and live stores are isolated; demo adapters cannot call Gateway. Integration fixture tests are not live compatibility certification.

## File map
- `server/store.ts`, `server/domain.ts`, `server/schema/`: SQLite migration/rollback and transactional business rules.
- `server/demo.ts`, `server/gateway.ts`: isolated sources and validated public-package adapter.
- `server/security.ts`, `server/app.ts`, `server/index.ts`: same-origin session/CSRF policy, API, loopback static server.
- `shared/types.ts`: versioned browser/domain contracts (no upstream private schema).
- `src/App.tsx`, `src/components/`, `src/lib/`, `src/styles.css`: accessible editorial workbench and local mascot policy.
- `tests/`: test-first domain, persistence, security, mock protocol integration and browser E2E.
- `docs/decisions/`: stage boundary, auth/trust, immutable context ADRs.
- `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/ci.yml`: honest setup/release guidance.
- `public/assets/lobster-*`: parent-owned; do not modify.

## Tasks and checks
1. Commit this plan and scaffolding early. Pin dependencies, strict TS, ESLint, Vitest, Playwright. Verify official public API/dependency licenses.
2. Write failing domain tests before implementation: create/promote/archive; exact selected excerpts/provenance; snapshots; zero dependent dispatch before both gates; duplicate start; stale context/revision; accounted-for work; crash unknown and restart persistence. Implement minimal transactional storage and deterministic bounded demo dispatcher; refactor behind tests.
3. Write HTTP security tests before handlers: Host/Origin deny, CSRF, local session cookie, unknown route/body validation, safe text, export allowlist. Implement same-origin app and bounded transcript pagination.
4. Integrate public client behind conservative capability boundary. Mock WebSocket handshake/session protocol; no live credentials or Gateway access. Clear not-paired/unsupported/unverified states; selected-session allowlist enforced server-side.
5. Build frontend workflow with excerpt preview, context editing/lifetimes/archive, run briefs/output inspector, decisions/revisions and separate start. Use original licensed source-level primitives, bundled OFL fonts, editorial lobster assets, light/dark and mobile panels.
6. Test mascot cooldown, idle/hidden suspension, warning suppression, opt-out, dismissal and reduced motion. No model/network calls.
7. Browser E2E: synthetic chat → select → project → stage → review → next explicit start. Large paginated transcript test. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`.
8. Review spec compliance then code/security quality. Record explicit gaps and second-order review. Commit, push feature branch and open draft PR only after checks pass. No merge/deploy/release or Gateway changes.

## Known approval boundary
Real device pairing and production Gateway certification require separately supplied credentials and operator approval. This build does not resolve that permission boundary silently. The MVP can ship for review as a verified demo with an honest live connection setup, not as a fully accepted V1 release.

## Incremental approved first-use guidance — September 15, 2026

Add a small demo-only, opt-in guided example after the initial MVP baseline. `src/lib/guidedDemo.ts` derives one instruction from observed selection/project/task/inspection/revision state; `GuidedDemo.tsx` renders inline help with navigation-only controls, Skip and replay. App/Chat expose real observed selection and successful snapshot inspection; existing backend writes and approval gates remain unchanged. No package/schema/live-capability changes. Test the observation policy first, then exercise the complete existing controls in browser E2E and prove skip/replay creates no project or approval by itself. Document the product principle without personal user context.
