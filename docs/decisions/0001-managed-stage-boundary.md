# ADR 0001 — Only app-managed stage admission is enforced

Date: 2026-09-14. Status: implementation of approved product decision. Reversibility: sticky.

Prior art: staged workflow approval/checkpoint pattern; the Gateway retains runtime tool approval authority. A read-only companion cannot safely pause arbitrary agent trees, and a core fork would add a much wider permission surface.

Each project contains ordered fixed stages, each with 1–4 independent tasks. One synchronous SQLite transaction persists task intent and a context snapshot before dispatch. A successor requires the predecessor's exact current approval revision and context version, plus a separate Start action. Approve itself has no dispatcher reference. Lost work becomes unknown and is never blindly repeated. Admission is globally limited to one stage at a time in this MVP.

App-local decisions are not Gateway exec/plugin approvals. Native child trees are observational, not a scheduling contract. The live adapter cannot dispatch at all until its lifecycle is separately verified. Demo task/session/run/idempotency IDs are deliberately distinct.

Consequence: future arbitrary workflow graphs or live descendant control must introduce a new capability/model rather than reinterpreting stage edges. The current limits are visible. Replacing this model later requires a migration and a separate owner-reviewed design.
