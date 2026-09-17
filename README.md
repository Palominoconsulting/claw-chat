# claw-chat

**Good work. Great claws.** A local review desk for agent conversations, source-linked project context and deliberately started stages.

**Status: reviewable MVP, not a certified V1 release.** The synthetic demo is runnable end to end. Live device pairing and Gateway execution are not certified; live execution is disabled in code. No cloud account, telemetry, subscription, public deployment or model key is needed for the demo.

## Run the demo

Requires **Node 26.5.x** (engines permit 26.5+ below 27) and npm. The service uses `node:sqlite`, which Node documents as release-candidate stability. We pin the tested runtime rather than silently supporting older SQLite implementations. There is no native SQLite add-on to compile.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4317**. `dev` builds the frontend and server, then runs both on one origin. It does not install a daemon or use a second development-server origin. After changes, stop and rerun it; hot module replacement is intentionally not part of this MVP.

For an already built checkout:

```sh
npm run build
npm start
```

Run commands from the repository root (migrations live under `server/schema`). Stop with Ctrl+C. Default database: `.data/demo.sqlite`. Restart preserves your projects, excerpts, snapshots and review records. Seeds run once per new database, not whenever a table becomes empty.

## Try the vertical slice

For hands-on first use, choose **Try a guided example** on the welcome screen. One inline instruction follows the real demo controls from excerpt selection through a separately started dependent stage. It advances only after observing the actual action/state, never from “Next” clicks. **Skip guide** leaves you in the normal workbench; replay is available on completion or from the welcome screen. No approval or task start is performed for you, and the guide has no live or model side effects. Reloading ends the guidance but preserves your real saved project.

Or explore directly:

1. **Explore on my own**, then select messages from the harbor conversation.
2. **Preview excerpts** and create a short-term project. Or add the selected excerpts to an existing active project.
3. In **Context**, edit item kinds, inspect provenance, promote lifetime or preview the project export.
4. In **Runs**, create a stage with up to four independent tasks and a dependent stage.
5. **Preview & start stage**, review its exact packet, then **Start simulated stage**. Every output is visibly labeled as deterministic simulation, not model inference.
6. In **Decisions**, examine each output, edit the proposal/assumptions, save its new revision, and write your review note. Approve, request changes or reject.
7. Go back to **Runs** and explicitly start the next stage. Approval never starts it automatically.

Photo-heavy welcome; compact working transcript. Light/dark themes, responsive panels, keyboard controls and reduced-motion support. The optional emotional-support lobster waits for about 20 minutes of active foreground use, makes no model calls, shares one cooldown, and can be dismissed or turned off. Its praise does not verify your work.

## Runtime settings

| Setting | Meaning |
| --- | --- |
| `PORT` | Loopback listener, default `4317`, range 1024–65535. Binding is always `127.0.0.1`. |
| `APP_ORIGIN` | Exact browser origin. Defaults to `http://127.0.0.1:$PORT`. No path, trailing slash or wildcard. Non-loopback origins must be HTTPS. |
| `APP_MODE` | `demo` (default) or `live`; fixed for the process lifetime. |
| `DATA_FILE` | Local SQLite path; defaults to `.data/<mode>.sqlite`. A mode marker refuses demo/live reuse. |
| `GATEWAY_URL` | Live-only explicit `ws://` loopback or `wss://` endpoint. No URL credentials, query strings or fragments. |
| `GATEWAY_BOOTSTRAP_TOKEN` | Live-only bootstrap token, supplied by your server-side secret facility as a process environment variable. Never put it in a command committed to source, browser field or `.env` file. |

An operator-provided private reverse proxy may supply an exact `APP_ORIGIN`. The proxy must preserve the browser-facing Host header, supply HTTPS and restrict access to the intended operator. claw-chat does **not** install a proxy, change Tailscale, modify Gateway origins or widen network access. `localhost` and `127.0.0.1` are different origins; use the configured one.

The browser session cookie is random, HttpOnly, SameSite=Strict, lasts up to 12 hours and is Secure on HTTPS. Sessions/CSRF tokens live only in process memory. A process restart requires a browser reload.

## Live connection: honest boundary

This build uses exact public npm packages `@openclaw/gateway-client@2026.8.1` and `@openclaw/gateway-protocol@2026.8.1`. Availability and licenses were checked; the actual published client is exercised against a synthetic WebSocket protocol server. **That is not proof of compatibility with a real Gateway. No live Gateway was accessed to build this MVP.**

To attempt read-only pairing, separately supply `GATEWAY_URL` and `GATEWAY_BOOTSTRAP_TOKEN` to the local process using your own secret facility, then start:

```sh
APP_MODE=live npm run dev
```

Open Connection settings and click **Request read-only pairing**. This is the first point at which a connection is opened. Approve the normal device-pairing request in your Gateway's existing interface if you choose to allow it. Nothing approves pairing automatically. The generic `gateway-client` identity in `ui` mode requests **only `operator.read`**; it does not impersonate the built-in Control UI or backend.

Device keys and issued tokens are in memory only. Restart requires a new pairing; durable OS-keychain integration is deferred. A hello from another Gateway release or with unexpected scopes is rejected conservatively. A successful candidate connection remains labeled **read-only, live unverified**.

The session index is an explicitly requested first page of up to 100 summaries. Only a selected conversation's bounded transcript is fetched. Unsupported history/identity shapes fail closed; there is no private-file fallback. Text and tool placeholders are escaped; tool results, attachments and URLs never execute. Transcript pages live only in memory unless you explicitly save excerpts. Existing channel chats remain inspection-only.

**There is no live send/start/write-upgrade path in this build.** This deliberately stops short of the approved full V1 acceptance. Normal write-scope pairing, fresh app-owned session creation, authoritative run/descendant completion and lost-ack reconciliation need a safe real Gateway fixture and independent validation before enabling that path. The demo dispatcher cannot be used in live mode.

See [compatibility](docs/compatibility.md) and [MVP acceptance](docs/mvp-acceptance.md).

## Durability and recovery

- A transaction persists launch intent, snapshot and unique task/run/session/idempotency identifiers before timers begin. Duplicate Start requests return no new work.
- One local process owns one database. Maximum four concurrent tasks globally, within one stage.
- A restart marks unfinished work **unknown**, without retry. In demo Decisions, supply a note and explicitly abandon stopped synthetic work to resolve it as failed. It is never reclassified as success. Use a fresh project for replacement execution.
- A hard crash can leave `<database>.lock`. Stop/verify that no claw-chat process owns the database before manually removing that lock file. The app will not guess, delete it or blindly resume work.
- Context changes invalidate earlier approvals and preserve launched snapshots. A stale execution cannot be re-certified against new context. This MVP requires a fresh project for revised execution; an ergonomic revise-and-rerun flow is deferred.
- Request-changes edits create a new proposal revision. Only the current revision can authorize the next start. It does not re-run earlier work.
- Archive is reversible; no history is deleted or active tool side effect undone. Local deletion/import are not implemented in the MVP.
- Export is an explicit preview followed by local JSON download. It contains only that project's curated context, tasks, snapshots and reviews, with `formatVersion: 1`. Authentication credentials and unselected history are excluded. Your own selected content may still be sensitive; inspect it before sharing.

## Development and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover transactional stage admission and revision/context gates; restart/unknown recovery; duplicate starts; export scope; exact excerpt provenance; Host/Origin/CSRF/session policy; credential-shaped text refusal; public-client handshake with a mock server; and mascot timing. Playwright covers the complete workflow, a 10,000-message source with at most 50 rendered messages, inert HTML, light/dark persistence and mobile/reduced-motion behavior. Tests and screenshots are synthetic only.

## Privacy, licensing and uninstall

Read [SECURITY.md](SECURITY.md). SQLite is **not encrypted** by this application. Use a protected local OS account/disk and backups appropriate for the context you choose to save. No secret detector can recognize every secret in prose; never paste credentials into chat or project fields. Recognizable credential patterns are refused before persistence as defense in depth.

Original source is MIT. UI primitives are original source wrappers around Apache-2.0 React Aria Components; no paid Untitled UI source is present. Fonts are bundled, open-licensed and self-hosted. Dependency/asset notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

To uninstall, stop the foreground process and remove this checkout and any separately configured `DATA_FILE` only after deciding whether to retain/export your projects. No services, cron jobs, system configuration or Gateway history are installed or removed. Filesystem backups, exports and SQLite journals may retain copies; deletion is not cryptographic erasure.
