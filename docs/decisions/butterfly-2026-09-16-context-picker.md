# Butterfly check — feature/context-picker (2026-09-16)

Scope: one PR branch, `feature/context-picker` (commit `5e2e520`), adding the wiki/skills context picker. Checked against `docs/specs/2026-09-16-context-picker.md` and ADR 0006 (same change set) using the `butterfly-check` method.

**Verdict: 3 decisions in this set. 1 two-way, 2 sticky, 0 one-way, 0 against the North Star. Merge.**

## Sticky decisions (ADR written)

1. **`ContextKind` gains `catalog_reference`.** Consumers (`Context.tsx`'s `Record<ContextKind, string>`, `editContext`'s immutability check) are compile-time exhaustive, so nothing silently mis-handles the new value. Sticky because removing it later would need a data migration for any saved item of this kind. ADR 0006 covers it.
2. **`SourceRef.gateway` gains a reserved `"catalog"` value, `operator: "local"`.** Any future export/filter code that switches on `gateway` inherits this. Chosen specifically to be unlike any real Gateway identity (ADR 0002's namespacing rule), so it does not collide with live data. ADR 0006 covers it.

## Two-way door

- New `GET /api/catalog` route and two save routes (`POST /api/catalog/projects`, `POST /api/projects/:id/catalog-context`). These are additive, versioned under `/api/v1/`, and nothing outside this feature depends on them yet. Reversible by removing the routes and the `catalog_reference` display path; no data loss since catalog-derived context items remain ordinary `ContextItem` rows.

## One-way door surfaced and deliberately not taken

- **Real local wiki/skills catalog integration.** This is the one decision in the task brief that could have become a one-way door (a filesystem reader wired into a public open-source app), and it is explicitly *not* built. `docs/specs/2026-09-16-context-picker.md` → "Scope decision" and ADR 0006 record why: the repo is public (`CONTRIBUTING.md` synthetic-only rule), the approved V1 security spec forbids a filesystem explorer without a separate reviewed exception, and no adapter shape exists for local files today (only the Gateway adapter). The `available: false` contract in live mode is the marked seam for that future decision. This is reported to the owner, not resolved.

## Standard cascade categories

- **Data model.** Covered above (two sticky enum/namespace additions). No nullable-becomes-required change, no free-text-standing-in-for-enum. `CatalogRef` is a small discriminated union (`wiki` | `skill`), versioned only in that it can grow a new kind later without breaking old refs (unknown refs already fail closed with "Unknown wiki page/skill artifact").
- **Interfaces and contracts.** Three new routes, documented above. All follow the existing `/api/v1/` versioning and the existing auth/CSRF/origin gate (`security.authorize`). None bypasses it.
- **Permissions and data boundaries.** `GET /api/catalog` does not require conversation selection (unlike `/api/history`), because it discloses only bundled synthetic fixture data, not per-session state — a narrower gate than most routes, not wider. This narrowness holds only while the catalog stays synthetic; ADR 0006 flags that explicitly as the seam to revisit if real data is ever added.
- **Agent and automation surface.** None. Nothing here is called by an agent; there is no "run" action anywhere in the feature, by design (spec: "Selection never executes a script").
- **Period, time and money semantics.** Not applicable.
- **Operational burden.** None — no new service, cron, secret or vendor. The fixture ships as static TypeScript in `server/catalog.ts`.
- **Cost curves.** Catalog is small and loaded once client-side; no per-keystroke network calls (client-side filter over an already-fetched fixture). At 10x/100x catalog size this would need pagination, but the fixture is intentionally tiny and synthetic, not a growth path yet.
- **Vendor and lock-in.** None. No new dependency; reuses existing `Button`/`Tag`/`Icon`/`Empty` primitives (React Aria Components, already vetted).
- **Removed behaviour (Chesterton).** Nothing removed.
- **Test and deploy shape.** No migration. No wall-clock-dependent test. `npm run check` (typecheck, lint, unit/integration, build) passes; Playwright suite passes in isolation (see PR notes on shared-machine flakiness under concurrent runs, reproduced identically on `main`/`fix/inspect-navigation` — not introduced by this change).
- **Documentation debt.** None found; the spec and ADR were written before merge, matching `docs/specs` conventions used by the rest of this repo.

## What I could not judge

- Whether Sean wants a real local catalog at all, and if so, which directories/confidentiality tiers apply. That is a product/security decision for the owner, not something this review can settle; it is the explicit ask this document routes back to him.
