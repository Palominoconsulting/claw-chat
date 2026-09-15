# Second-order-effects check — MVP

North Star: approved `docs/specs/2026-09-14-v1-design.md`, especially purpose, managed-stage enforcement, provenance and explicit permissions. No other platform's context was used.

**Verdict: six decisions; three sticky, three two-way, no new one-way permission change, no contradiction hidden as completed V1. Hold release pending real Gateway validation, independent review and human smoke testing. A draft review PR is appropriate.**

## Sticky decisions

1. **Ordered, bounded stages with explicit approval + separate start** (ADR 0001). In six months saved workflows depend on these semantics; later graph support needs migration, not reinterpretation of parent edges. Supports the spec's stage-only promise. Cost to change: coordinated data/model change.
2. **One local OS operator, same-origin session, explicit read-only pairing** (ADR 0002). Multi-user or publicly hosted access would require a new authorization design. In 24 months do not let an easy reverse-proxy setup be mistaken for tenant isolation. Cost to change: security redesign and identity migration.
3. **Original excerpts, immutable snapshots/events and versioned export** (ADR 0003). Users may retain exports for years. A field becoming authoritative outside the app is difficult to change; `/api/v1` and `formatVersion: 1` make the boundary explicit. Cost to change: versioned migration with preserved historical text. No silent snapshot rewriting.

## Two-way decisions

- Node 26.5/built-in SQLite rather than a native add-on: runtime floor is visible; standard SQLite data survives a later adapter replacement. Test a new runtime before relaxing engines.
- Memory-only live keys and no live execution: inconvenient pairing, but no expanded permission grant. Add durable keys/write execution only through a separately verified design.
- Original React Aria-backed primitives and local mascot policy: no paid component/source dependency, no external model cost; visual structure can evolve without changing project records.

## Explicit gaps, not silently resolved questions

Real pairing/write-scope/result reconciliation require a separately authorized fixture and remain blocked. Keychain persistence, deletion/import, full native lineage and large session-index pagination remain deferred. Re-running stale execution uses a fresh project in this MVP; this is labeled as a limitation, not a change to full V1 acceptance. No scope increase was implemented to make the live screen appear connected.

## Category scan

- Data model: UTC timestamps, distinct identifiers, immutable launch/review history. Typed JSON entity payloads are app-owned; SQL foreign keys and unique idempotency keys enforce identity. Future external SQL consumers would create unwanted coupling.
- Interfaces/contracts: `/api/v1`, export v1, explicit environment contract and schema migration versions documented. No existing public API removed.
- Permissions/data: explicit selected-page capture, mode-isolated database, in-memory credentials, no private-file fallback. Single trusted OS user is the documented ceiling.
- Agent/automation: no real inference, daemon, native scheduling or runtime auto-approval. Live writes absent.
- Time/money: UTC persisted; display has zone labels. No currency semantics or model cost assumptions added.
- Operations: local foreground process, owner lock, explicit stopped-demo reconciliation. Hard-crash lock removal is manual and documented.
- Cost curves: no per-request model cost; transcripts are page-bounded. Snapshot retention grows local storage, and full workspace-state lists are not a certified large multi-project archive. No automatic deletion.
- Vendor exit: MIT/Apache/OFL dependencies and SQLite export; no cloud service holds data. Fonts are local.
- Removed behavior: no prior runtime implementation removed; approved docs preserved.
- Test/deploy: synthetic-only fixtures, forward/rollback migrations, no deployment or Gateway changes. CI has read-only repository permission and no secrets.
- Documentation: acceptance gaps and live-unverified boundary are visible in UI and README; no release claim.

## Cannot judge here

A real Gateway's pairing policy, actual session/result projection, native descendant lifecycle and compatibility under connection loss need the separately authorized fixture. Independent reviewer must assess the final code plus the parent-owned artwork commit before release.
