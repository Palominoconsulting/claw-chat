# Compatibility matrix

| Surface | Version / evidence | Status |
| --- | --- | --- |
| Node / built-in SQLite | Node 26.5.0; real file-backed/in-memory tests | Tested locally; Node calls SQLite release-candidate stability |
| Gateway client package | Public npm `@openclaw/gateway-client` 2026.8.1 | Exact installed pin, MIT |
| Gateway protocol package | Public npm `@openclaw/gateway-protocol` 2026.8.1, wire v4 | Exact installed pin, MIT |
| Mock server | Challenge, signed device payload, operator.read connect, hello-ok, sessions.list, selected chat.history | Integration tested using actual public Node client |
| Real Gateway | None | **Unverified. No credentials supplied or real server accessed.** |
| Older/newer Gateway releases | No allowlist profile | Unsupported; do not upgrade the user's Gateway automatically |
| Live managed stages | No code path | Disabled pending write pairing + session lifecycle + authoritative reconciliation verification |

Package availability and official docs were checked September 14, 2026. Exact-version compatibility is a candidate boundary, not a promise that wire version 4 implies identical RPC payloads. Unexpected server version, auth role/scopes or response shape fails closed. There is no fallback into private transcripts or installed hashed distribution code.

The read-only MVP lists one page of at most 100 session summaries. History is at most 50 messages per page with bounded text. Missing identity rejects capture. Source times not supplied are labeled unavailable. All live lineage is conservatively incomplete; omitted tool/image parts are text placeholders. No subscriptions/replay claim, full tool inspector, 1,000-summary browsing or native descendant scheduler is shipped.

References (primary sources):
- https://docs.openclaw.ai/gateway/clients
- https://docs.openclaw.ai/gateway/protocol
- https://docs.openclaw.ai/gateway/protocol/rpc-session-control
- https://nodejs.org/api/sqlite.html
- Public installed packages' README, declarations and LICENSE files.
