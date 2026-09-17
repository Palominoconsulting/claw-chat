# ADR 0002 — Same-origin local service; explicit, read-only Gateway identity

Date: 2026-09-14. Status: approved trust boundary, conservative MVP implementation. Reversibility: sticky.

Prior art: synchronizer-token CSRF protection with SameSite cookies; Gateway's supported challenge-bound device pairing. Loopback alone is insufficient against cross-site requests.

Bind 127.0.0.1; validate exact APP_ORIGIN and Host, reject cross-site fetch metadata, use in-memory random browser sessions/CSRF, strict CSP and escaped text. No secret enters URL/localStorage/SQLite or logs. No auto-read of Gateway state/credentials. A trusted local OS user remains the boundary; untrusted local agents need OS isolation. The bootstrap endpoint is not authentication against another process running as that user.

Live uses the public pinned Node client with generic gateway-client/ui identity and operator.read only. Keys and issued tokens stay in memory, so restarting requires pairing again. Only explicit server inputs are consumed. No live write or scope-upgrade endpoint exists in the MVP; changing that is a permission decision requiring review and a real fixture.

Consequences: no seamless persistent pairing yet; no remote/public hosting claim; one operator can access locally saved projects. A later keychain-backed identity store must preserve Gateway+authenticated-principal namespacing and clear in-memory selections on identity change. Device namespace is not a human identity assertion.
