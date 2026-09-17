# ADR 0003 — Immutable captured speech and launch snapshots

Date: 2026-09-14. Status: implementation of approved product decision. Reversibility: sticky.

Prior art: immutable event/snapshot records and optimistic revision checking. Context provenance must remain separate from the assertion that a statement is correct.

Source excerpts are resolved server-side from the selected, viewed transcript page. Original text/hash and source identity remain distinct from later typed interpretations. Context changes increment project/context versions and invalidate approvals. A launched stage retains its original snapshot and SHA-256 digest. Reviews append events and refer to exact stage revisions. Snapshot text is only the app's contribution, never the complete model prompt.

The MVP rejects re-certifying old execution against changed context; revised execution starts in a fresh project. An ergonomic revision/rerun scope flow is deferred rather than overwriting old evidence. Archive is reversible; no deletion/import route is shipped.

HTTP routes are namespaced under /api/v1; unknown API versions are rejected. Export JSON has formatVersion=1 and an explicit project-owned allowlist. Treat v1 as a preview contract until release. Adding import or third-party automation against HTTP routes requires version negotiation. SQLite uses relational identity/foreign-key columns with typed JSON payloads for app-owned values; schema migrations track payload evolution as well as SQL changes. Original text that cannot be recovered from an older edited record is marked unavailable rather than fabricated.

Undoing snapshot retention or export semantics would affect user records. Preserve data with a versioned migration; do not silently rewrite old launch evidence.
