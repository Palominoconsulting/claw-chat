# claw-chat: visual wiki/skills context picker

Status: **Approved by the project owner in chat ("sweet build that") on September 16, 2026.** This document records the approved design for implementation; it does not reopen brainstorming.

## Purpose

Today a claw-chat operator can only build project context from chat excerpts. Before starting a chat or a stage, an operator often already knows which reusable knowledge (wiki projects/topics/pages) or reusable procedures (skills) are relevant. This feature adds a dedicated, read-only **Context picker** screen: browse or search wiki pages and skills, preview them, and select items into a **Context for this chat** tray before saving them into a project the same way chat excerpts are saved today.

## Prior art

Researched September 16, 2026 (web search, no private content in queries):

- **VS Code Quick Open / Command Palette** (`Ctrl/Cmd+P`, `Ctrl/Cmd+Shift+P`): a single searchable, keyboard-navigable list with fuzzy matching and live filtering is the established pattern for "find one thing out of many, fast, without a mouse." We reuse this shape for the catalog search box instead of inventing a new interaction.
- **ChatGPT "Company Knowledge" / attach-file picker**: explicit user action (`+` / `@mention`) opens a picker, the user chooses a specific source, and the response cites what was used. We reuse the "explicit selection, never silent inclusion" principle: nothing enters context without the operator adding it to the tray and saving.
- Both patterns confirm the same anti-pattern to avoid: a graph/network visualization as the primary way to find one item. VS Code and ChatGPT both use a flat, searchable, hierarchical-when-helpful list, not a node-link "hairball." This directly matches the existing product principle ("avoid generic graph hairball").

No existing claw-chat surface reads local wiki or skills files; this is new ground, addressed below.

## Scope decision: synthetic catalog only (stop-and-report)

The task asked to wire up a truthful, usable **local** catalog if the existing trust model allows it, and to stop and report rather than quietly enable a new permission/trust decision.

**Finding: it does not currently allow it, and this PR does not attempt it.**

1. **claw-chat is a public repository** (`Palominoconsulting/claw-chat`, confirmed public via `gh repo view`). `CONTRIBUTING.md` is explicit: "Use synthetic conversations, names, screenshots, fixtures and logs only. Never include real workspace data... in issues, PRs or artifacts." The real wiki (`~/.openclaw/wiki/main/`) and skills (`~/.openclaw/workspace/skills/`, `~/.agents/skills/`) contain live client names, deal terms, credentials-adjacent operational notes, and firm-confidential material governed by the workspace's Need-to-Know policy. There is no existing redaction/filtering layer that could sit between those directories and a public open-source app's server process.
2. **The approved V1 security spec forbids exactly this shape of feature**: "No arbitrary RPC proxy, filesystem explorer, terminal, attachment execution, Gateway config editor, or built-in auto-approval of runtime tools" (`docs/specs/2026-09-14-v1-design.md`, Security and privacy). A live reader of local wiki/skills directories, however read-only, is a filesystem explorer of exactly the kind that line rules out without a separate approved decision.
3. **No existing adapter shape covers this.** Every real-data touchpoint in the app so far is the Gateway adapter (`server/gateway.ts`), a WebSocket protocol client with its own pairing, scoping and honesty-boundary work (ADR 0002). Local wiki/skills content is not exposed through that Gateway protocol at all; a new integration would need its own new adapter, new scoping model, and a new answer to "which local paths, whose Workspace, what confidentiality tier" — none of which is decided.

**Decision:** ship the picker against a small, explicitly labeled **synthetic** catalog (a handful of fixture wiki pages and skill cards, structurally realistic but entirely made up), following the same demo/live separation the app already uses for conversations (`server/demo.ts` vs `server/gateway.ts`). The catalog endpoint's response always says whether it is synthetic; there is no code path that reads a real local wiki or skills directory.

**Reported, not enabled:** if a real local catalog is wanted later, it requires an explicit owner decision on: which directories are in scope, what confidentiality/need-to-know filtering happens server-side before anything reaches the browser, whether it is scoped per-project like Gateway session selection is today, and whether the "no filesystem explorer" security line in the V1 spec needs a formal amendment (ADR) to carve out a narrow, reviewed exception. This document does not decide any of that; it flags it for Sean.

## Approved design

### Entry point

A new **"Browse wiki & skills"** action, available from the Sidebar (next to Connection settings) and from the Chat empty/composer area. It opens a dedicated screen (`screen: "catalog"`), consistent with the existing `welcome` / `workspace` / `setup` screen pattern in `App.tsx`. It is reachable before a conversation or project exists, matching "before chat browse... select to Context for this chat tray."

### Layout

- **Search bar** at the top: single text input, live-filters both wiki and skills by title/tags/summary. Debounced client-side filtering only (no network round trip per keystroke); the full synthetic catalog is small and loaded once.
- **Two source panes**, switchable by tab-like buttons (`Wiki`, `Skills`), each a flat, keyboard-navigable list — not a node-link graph. Wiki adds one level of grouping (`Project / Topic`) shown as a collapsible, searchable list (à la a file tree in a sidebar, not a canvas graph), matching "navigable map plus searchable list" without building a hairball visualization.
- **Preview pane**: selecting a wiki page or a skill artifact shows its full synthetic text read-only, with clear "SYNTHETIC — fixture content" labeling and a single **Add to context tray** button per item.
- **Context tray**: a persistent list (visible on desktop as a right-hand panel, and as a bottom sheet / stacked section on mobile) of everything added so far, each with a remove control. A **Save to project** action opens the same target picker used by Chat (`Create project` vs `Add to project`, name + lifetime, matching `Chat.tsx`'s existing form) and posts through the existing `/api/projects` and `/api/projects/:id/context` endpoints — no new save path.

### Skill cards

Each skill card shows:
- Name and one-line summary.
- **Artifact badges**, one per distinct artifact kind present: `MD` (markdown/instructions), `Script` (with a language sub-label: Python / Shell / JavaScript), `Template`, `Workflow`. Badges are file-type only and carry no safety meaning.
- A separate **behavior label**, visually distinct from the artifact badges (different shape/position, e.g. a pill under the title, never merged into a badge): `Read-only`, `Writes files`, `External actions`, or `Unknown`. This label is authored per skill in the catalog fixture, not derived from file extension, and is never inferred from artifact type. A `Script` badge next to a `Read-only` label and a `Script` badge next to a `Writes files` label must look identical in file-type styling and different only in the behavior pill — the whole point is that file type never implies safety.
- Expand to see individual artifacts (files) within the skill; each artifact is independently previewable and independently addable to the tray (so an operator can pull in just the one instructions file they need, not the whole skill body).

### What selection does and does not do

- Adding a wiki page or skill artifact to the tray, and saving the tray to a project, creates ordinary `ContextItem` rows — the same storage claw-chat already uses for chat excerpts. A new `ContextKind` value, `catalog_reference`, distinguishes these from chat-sourced `source_excerpt` items in the UI and API; both are immutable-original the same way (see Data model below).
- Selection **never executes a script, opens a file outside the read-only preview, grants any tool/runtime permission, or changes any Gateway scope.** There is no "run" button anywhere in this feature. The only side effect of "Add to context tray" is a piece of text (the previewed content) sitting in local browser state until explicitly saved; the only side effect of "Save to project" is the existing, already-reviewed `insertContext` write path.
- "Selected context distinct from later retrieval": the saved `ContextItem.text` is the exact synthetic preview text captured at selection time (same immutability model as a chat excerpt's `originalText`/`originalHash`). If the (synthetic, fixture) catalog entry later changes, already-saved context does not silently change; this mirrors the existing "a later source becoming unavailable does not silently replace the saved excerpt" rule for chat excerpts.

### Behavior in live mode

The catalog endpoint reports `{ available: false, reason: "..." }` in live mode: there is no live wiki/skills adapter, so the picker in live mode shows a clear "not available" state with the reason, never an empty list masquerading as a complete answer to "no wiki pages exist."

### Accessibility and mobile

- All controls are reachable and operable by keyboard alone: search input, list navigation (arrow keys within each list, following the existing `Sidebar`/`Tree` pattern of a list of `Button`s), preview, add/remove from tray, save. No functionality is mouse-only.
- On narrow screens (reusing the existing `max-width: 680px` breakpoint already used for the Inspector), the picker collapses to one visible section at a time (search+list, or preview, or tray) with a back control, matching the existing "switch panels instead of squeezing three columns" principle from the V1 spec rather than adding new responsive infrastructure.
- No new component library. Built from the existing `Button`, `Tag`, `Icon`, `Empty` primitives in `src/components/Primitives.tsx` (React Aria Components under the hood, already MIT/Apache-2.0-clear per `THIRD_PARTY_NOTICES.md`).

## Data model

No SQL migration. `ContextItem` already stores `kind`, `text`, `author`, `source` (a `SourceRef`), `hash`/`originalHash`, `capturedAt`, `version` as an opaque JSON blob — no new columns are needed.

- **`ContextKind`** gains one value: `"catalog_reference"`. Existing kinds are unchanged.
- **`SourceRef`** is reused as-is for catalog-derived items, with a distinct, clearly non-conversational shape so it can never collide with a real Gateway session:
  - `gateway: "catalog"` (a reserved value; the app already namespaces by `gateway`+`operator`, per ADR 0002 — `"catalog"` is not a value any Gateway adapter can produce)
  - `operator: "local"`
  - `sessionKey: "wiki:<page id>"` or `"skill:<skill id>"`
  - `sessionId`: the wiki page id or skill id
  - `messageId`: the specific artifact id previewed and added (or the page/skill id itself for a whole-page/whole-skill add)
- Immutability: `editContext`'s existing rule ("captured source excerpts remain exact... an edited note must not impersonate original speech") is generalized from `kind === "source_excerpt"` to `kind === "source_excerpt" || kind === "catalog_reference"`. A catalog reference can be recategorized to `note` (editable) but its original captured text cannot be silently rewritten while still labeled as a catalog reference.

## New server surface

- `GET /api/catalog` — returns the synthetic wiki tree (projects → topics → pages, each page has id/title/tags/summary/body) and the synthetic skill list (each skill has id/name/summary/behavior/artifacts[], each artifact has id/kind/language?/title/body), or `{ available: false, reason }` in live mode. Read-only, no state mutation, no session selection required (this is not conversation history; it does not disclose any project/session-scoped data).
- No new POST route. Saving a catalog selection reuses `/api/projects` (create) and `/api/projects/:id/context` (add), exactly as chat excerpts do today, with `excerpts` built from catalog items instead of chat messages.

## Second-order effects (butterfly-check input)

Full pass runs via the `butterfly-check` skill before merge; noted here up front for the reviewer:

- **`ContextKind.catalog_reference` is a new, versioned enum value** consumed by the API's zod schema and the UI's label map. Two-way door: adding an enum value is backward compatible (old data has no such kind; nothing currently switches exhaustively on `ContextKind` in a way that would silently mis-handle an unknown value — `Context.tsx`'s `kindLabels` is a `Record<ContextKind, string>`, so TypeScript enforces the new label is added everywhere it matters).
- **New `gateway: "catalog"` reserved value in `SourceRef.gateway`.** Sticky: once shipped, this string is a contract other code (exports, future filters) could match on. Documented here and in the ADR; treated the same as any other Gateway identity namespace per ADR 0002's "never join equal-looking IDs across Gateways" rule — `"catalog"` is deliberately unlike any real Gateway id.
- **No new permission surface.** The catalog endpoint requires the existing authenticated same-origin browser session (all `/api/*` routes go through `security.authorize`/`security.checkOrigin`) but not `selected()` (no conversation selection needed), since it exposes only bundled synthetic fixture data, not per-session private state. This is called out explicitly so a future contributor does not assume `/api/catalog` needs conversation-selection gating if real content is ever added — it will need a completely different gate at that point (see Scope decision above).
- **Real-catalog integration is explicitly deferred, not silently foreclosed or silently enabled.** See Scope decision. This is the one-way-door risk worth tracking: if someone later wires a real filesystem reader into this same UI without redoing the trust review, the "synthetic only, no filesystem explorer" boundary silently breaks. The code marks this with an explicit `available: false` contract and a comment pointing at this doc, so it cannot be "quietly" swapped without touching a clearly labeled spot.

## Test plan

- Unit: catalog search/filter behavior (title/tag matching, case-insensitivity, empty-query returns all); behavior-label rendering independent of artifact kind (a `Script` artifact with `read_only` behavior and one with `writes_files` behavior render the same badge, different pill).
- Integration: `GET /api/catalog` in demo mode returns the fixture shape and `available: true`; in live mode returns `available: false` with a reason and no fixture leakage; unauthenticated/cross-origin requests are rejected the same as other routes (reuses `security.test.ts` patterns).
- Domain: saving a catalog selection creates a `catalog_reference` context item with the expected `SourceRef` shape and immutability behavior (edit rejects text change without first recategorizing to `note`, mirroring the existing `source_excerpt` test).
- Browser/E2E (Playwright): open the picker, search, preview a wiki page and a skill artifact, add both to the tray, remove one, save the remaining one into a new project, confirm it appears in that project's Context tab with `catalog_reference` labeling. Run at desktop width and at 320×568 / 390×844 mobile viewports. Keyboard-only pass: reach every control via Tab/Shift+Tab/Enter/Space without a pointer.
- Screenshots: desktop and both mobile widths, saved under `.artifacts/` (gitignored — not committed), synthetic content only.
