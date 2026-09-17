# Architecture at a glance

claw-chat is a single-operator local companion. Approved product contract: `docs/specs/2026-09-14-v1-design.md`; limits: `docs/mvp-acceptance.md`.

Node 26.5+, strict TypeScript, node:sqlite; React 19, Vite 8, Tailwind 4. Original MIT UI views wrap Apache-2.0 React Aria buttons. Instrument Sans + Fraunces are bundled OFL fonts. One foreground process on 127.0.0.1:4317 serves same-origin browser assets/API. No cloud, telemetry, network configuration, daemon or model in the demo.

`server/app.ts` validates API inputs and explicit source selection. `security.ts` owns in-memory browser sessions/CSRF and exact Host/Origin. `domain.ts` owns snapshots, revisions and transactional admission. `store.ts` applies append-only SQL migrations and persists typed JSON entity payloads with relational foreign keys/uniqueness. Only the app owns payload writes; no external SQL/HTTP compatibility promise beyond documented versioned export v1. `demo.ts` is deterministic and isolated. `gateway.ts` uses pinned public 2026.8.1 packages; read-only candidate, not live-certified. Device pairing credentials never enter SQLite or browser state.

APP_MODE selects a distinct database namespace. PORT/APP_ORIGIN select the local listener/browser trust boundary. GATEWAY_URL/GATEWAY_BOOTSTRAP_TOKEN are explicit server inputs only in live mode. Nothing auto-loads another application's private files. The live code has no execution or scope-upgrade route.

Production build: `npm run build`, foreground start: `npm start`. Development convenience: `npm run dev` (build then start, no HMR). Run from checkout root for migrations. State owner lock prevents simultaneous dispatchers; stopped unknown demo work requires explicit reconciliation. All timestamps are UTC ISO strings, localized with a zone label only at display.
