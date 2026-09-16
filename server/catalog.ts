import type {
  Catalog,
  CatalogRef,
  CatalogUnavailable,
  Excerpt,
} from "../shared/types.js";
/**
 * Synthetic, fixture-only wiki/skills catalog for the demo "Browse wiki & skills"
 * picker. This module never reads a real local filesystem, wiki vault or skills
 * directory. See docs/decisions/0006-catalog-context-picker.md: a real local
 * catalog integration is an explicit, separately reviewed decision that is not
 * made here. Do not point this at a real directory without that review.
 */
export function syntheticCatalog(): Catalog {
  return {
    available: true,
    synthetic: true,
    pages: [
      {
        id: "wiki-harbor-overview",
        project: "Harbor Field Guide",
        topic: "Overview",
        title: "What the harbor guide covers",
        tags: ["harbor", "overview", "scope"],
        summary:
          "Synthetic fixture: scope and audience for the harbor field guide project.",
        body: "SYNTHETIC FIXTURE. This project collects public, non-sensitive observations about a fictional harbor for a first-time-visitor field guide. It intentionally excludes nesting sites and anything requiring private access. Treat every tide estimate as an assumption until an operator reviews it.",
      },
      {
        id: "wiki-harbor-tides",
        project: "Harbor Field Guide",
        topic: "Tides & routes",
        title: "Tide-dependent walking routes",
        tags: ["harbor", "tides", "routes"],
        summary:
          "Synthetic fixture: how tide timing affects which shoreline paths are walkable.",
        body: "SYNTHETIC FIXTURE. The east path is reported less accessible at high tide in this fictional scenario. No real survey was performed. Cross-check any real route recommendation against a current, official tide table before publishing.",
      },
      {
        id: "wiki-review-standards",
        project: "Review Standards",
        topic: "Checkpoints",
        title: "What a checkpoint review must include",
        tags: ["review", "checkpoint", "standards"],
        summary:
          "Synthetic fixture: the minimum fields a decision review should contain.",
        body: "SYNTHETIC FIXTURE. A complete review records the proposed decision, the evidence examined, explicit assumptions, missing information, and the alternatives considered before an approve/changes/reject choice is made.",
      },
    ],
    skills: [
      {
        id: "skill-field-notes",
        name: "field-notes-formatter",
        summary:
          "Synthetic fixture: formats raw observation notes into a consistent field-guide entry.",
        behavior: "read_only",
        artifacts: [
          {
            id: "skill-field-notes:instructions",
            kind: "md",
            language: null,
            title: "SKILL.md",
            body: "SYNTHETIC FIXTURE INSTRUCTIONS. Read the raw notes, extract location, date and observation, and produce a three-line entry. This artifact only describes a procedure; selecting it does not run anything.",
          },
          {
            id: "skill-field-notes:template",
            kind: "template",
            language: null,
            title: "entry-template.md",
            body: "SYNTHETIC FIXTURE TEMPLATE.\nLocation: {location}\nDate: {date}\nObservation: {observation}",
          },
        ],
      },
      {
        id: "skill-tide-lookup",
        name: "tide-table-lookup",
        summary:
          "Synthetic fixture: a helper script concept for cross-checking a tide table.",
        behavior: "external_actions",
        artifacts: [
          {
            id: "skill-tide-lookup:instructions",
            kind: "md",
            language: null,
            title: "SKILL.md",
            body: "SYNTHETIC FIXTURE INSTRUCTIONS. Describes when to consult an external tide table service before publishing a route recommendation.",
          },
          {
            id: "skill-tide-lookup:script",
            kind: "script",
            language: "python",
            title: "lookup_tides.py",
            body: "# SYNTHETIC FIXTURE SCRIPT BODY — preview text only.\n# This artifact is never executed by the picker. It would call an\n# external tide-table service if actually run by a human/tool.\nprint('fixture only: would look up tide data here')",
          },
        ],
      },
      {
        id: "skill-shore-cleanup-log",
        name: "shore-cleanup-logger",
        summary:
          "Synthetic fixture: a helper script concept for writing a local cleanup log file.",
        behavior: "writes_files",
        artifacts: [
          {
            id: "skill-shore-cleanup-log:instructions",
            kind: "md",
            language: null,
            title: "SKILL.md",
            body: "SYNTHETIC FIXTURE INSTRUCTIONS. Describes appending a dated line to a local cleanup log after a volunteer shift.",
          },
          {
            id: "skill-shore-cleanup-log:script",
            kind: "script",
            language: "shell",
            title: "log_cleanup.sh",
            body: "# SYNTHETIC FIXTURE SCRIPT BODY — preview text only.\n# This artifact is never executed by the picker. It would append a\n# line to a local log file if actually run by a human/tool.\necho \"fixture only: would append a cleanup log line here\"",
          },
          {
            id: "skill-shore-cleanup-log:workflow",
            kind: "workflow",
            language: null,
            title: "post-shift-checklist.md",
            body: "SYNTHETIC FIXTURE WORKFLOW. 1) Count collected items. 2) Note the location. 3) Run the logger artifact yourself, outside this app, if you choose to.",
          },
        ],
      },
      {
        id: "skill-unlabeled-import",
        name: "legacy-import-helper",
        summary:
          "Synthetic fixture: an older helper whose real-world side effects were never documented.",
        behavior: "unknown",
        artifacts: [
          {
            id: "skill-unlabeled-import:instructions",
            kind: "md",
            language: null,
            title: "SKILL.md",
            body: "SYNTHETIC FIXTURE INSTRUCTIONS. This fixture intentionally represents a skill whose behavior was never classified. The picker must still show an explicit 'Unknown' behavior label rather than guessing safety from its file types.",
          },
          {
            id: "skill-unlabeled-import:script",
            kind: "script",
            language: "javascript",
            title: "import.js",
            body: "// SYNTHETIC FIXTURE SCRIPT BODY — preview text only.\n// Never executed by the picker.\nconsole.log('fixture only: behavior intentionally unclassified');",
          },
        ],
      },
    ],
  };
}
export function catalogUnavailable(reason: string): CatalogUnavailable {
  return { available: false, reason };
}
/**
 * Resolves each requested reference against the authoritative synthetic
 * catalog on the server, never trusting client-supplied excerpt text. Mirrors
 * the existing chat-excerpt integrity model in server/app.ts's `excerpts()`:
 * the browser names what it selected, the server decides what it actually was.
 */
export function resolveCatalogExcerpts(refs: CatalogRef[]): Excerpt[] {
  const catalog = syntheticCatalog();
  if (new Set(refs.map((ref) => JSON.stringify(ref))).size !== refs.length)
    throw new Error("Duplicate catalog selection is ambiguous");
  return refs.map((ref) => {
    if (ref.kind === "wiki") {
      const page = catalog.pages.find((item) => item.id === ref.pageId);
      if (!page) throw new Error("Unknown wiki page in catalog selection");
      return {
        text: page.body,
        author: `Wiki · ${page.project} / ${page.topic}`,
        source: {
          gateway: "catalog",
          operator: "local",
          sessionKey: `wiki:${page.id}`,
          sessionId: page.id,
          messageId: page.id,
        },
      };
    }
    const skill = catalog.skills.find((item) => item.id === ref.skillId);
    const artifact = skill?.artifacts.find((item) => item.id === ref.artifactId);
    if (!skill || !artifact)
      throw new Error("Unknown skill artifact in catalog selection");
    return {
      text: artifact.body,
      author: `Skill · ${skill.name} / ${artifact.title}`,
      source: {
        gateway: "catalog",
        operator: "local",
        sessionKey: `skill:${skill.id}`,
        sessionId: skill.id,
        messageId: artifact.id,
      },
    };
  });
}
