# ADR 0006 — Synthetic-only wiki/skills context picker; real catalog deferred

Date: 2026-09-16. Status: approved product decision, conservative implementation. Reversibility: sticky (enum value, reserved namespace); the real-catalog question itself is explicitly undecided, not resolved.

Prior art: VS Code Quick Open/Command Palette (searchable, keyboard-navigable flat list over a graph visualization); ChatGPT's explicit-selection "Company Knowledge" attach pattern (nothing enters context without an explicit user add). See `docs/specs/2026-09-16-context-picker.md` for the full research note.

## Decision

Add a `Browse wiki & skills` picker screen that lets an operator search/preview a small **synthetic** catalog of wiki pages and skill cards and add selections to a `Context for this chat` tray before saving them into a project through the existing chat-excerpt save path. No new save path, no new SQL migration.

Two small, sticky data-model additions carry this:

1. `ContextKind` gains `"catalog_reference"`, alongside the existing `source_excerpt`, `note`, `constraint`, `assumption`, `proposed_decision`, `approved_decision`. Immutability rules that previously checked `kind === "source_excerpt"` now also cover `catalog_reference`.
2. `SourceRef.gateway` gains a reserved value `"catalog"` (with `operator: "local"`), used only for catalog-derived context items. This is namespaced the same way ADR 0002 requires for any Gateway identity: it can never collide with a real Gateway id, and nothing joins `"catalog"` sources to `"catalog"` sources from a different app instance.

## What this explicitly does not decide

Whether claw-chat should ever read a **real** local wiki or skills directory is not decided here and is not implemented. `docs/specs/2026-09-16-context-picker.md` → "Scope decision" records why: claw-chat is a public repository (`CONTRIBUTING.md`: synthetic-only in all public artifacts), the approved V1 security spec forbids "a filesystem explorer... or built-in auto-approval" without a separate reviewed exception, and no existing adapter shape (Gateway-only) covers local files at all. Building that integration would need its own ADR covering: which directories, what confidentiality/need-to-know filtering happens server-side, whether it is scoped like conversation selection, and an explicit amendment to the V1 security spec's filesystem-explorer prohibition. This ADR flags that decision for the owner; it does not make it.

The catalog endpoint (`GET /api/catalog`) always reports whether its data is synthetic; live mode returns `available: false` with a reason rather than an empty catalog that could be mistaken for "no real wiki content exists."

## Consequences

- A future contributor adding a real catalog source must not silently point the existing `/api/catalog` route or `ContextPicker` UI at real files; the `available: false` contract in live mode is the marked seam where that decision belongs, and it requires updating this ADR (or writing a new one) plus the security spec amendment described above.
- `catalog_reference` and `gateway: "catalog"` are contract surface the moment this ships (Hyrum's Law): any future export-format or filter code that switches on `ContextKind` or `SourceRef.gateway` must account for them. `Context.tsx`'s `Record<ContextKind, string>` label map already forces this at compile time.
- No permission, scope, or Gateway-adapter change. `GET /api/catalog` requires the same authenticated same-origin session as every other route but does not require conversation selection, because it discloses only bundled fixture data — not per-session state. This is a narrower gate than session-scoped routes, not a wider one, and it stays narrow only as long as the catalog stays synthetic.
