import { describe, expect, it } from "vitest";
import { syntheticCatalog } from "../server/catalog.js";
import type { CatalogArtifact, CatalogSkill } from "../shared/types.js";
describe("synthetic catalog fixture", () => {
  const catalog = syntheticCatalog();
  it("is explicitly marked available and synthetic", () => {
    expect(catalog.available).toBe(true);
    expect(catalog.synthetic).toBe(true);
  });
  it("contains at least one wiki page grouped under a project and topic", () => {
    expect(catalog.pages.length).toBeGreaterThan(0);
    for (const page of catalog.pages) {
      expect(page.project.trim()).not.toBe("");
      expect(page.topic.trim()).not.toBe("");
      expect(page.title.trim()).not.toBe("");
      expect(page.body.trim()).not.toBe("");
    }
  });
  it("contains at least one skill with multiple distinct artifact kinds", () => {
    expect(catalog.skills.length).toBeGreaterThan(0);
    const kinds = new Set(
      catalog.skills.flatMap((skill) =>
        skill.artifacts.map((artifact) => artifact.kind),
      ),
    );
    expect(kinds.size).toBeGreaterThan(1);
  });
  it("labels every skill with a behavior independent of its artifact kinds", () => {
    const behaviors: CatalogSkill["behavior"][] = [
      "read_only",
      "writes_files",
      "external_actions",
      "unknown",
    ];
    for (const skill of catalog.skills)
      expect(behaviors).toContain(skill.behavior);
  });
  it("never implies safety from a script artifact's language alone", () => {
    // A read-only skill and a writes-files skill both carry Script artifacts;
    // the artifact shape itself must not differ by behavior.
    const scriptArtifacts: { skill: CatalogSkill; artifact: CatalogArtifact }[] =
      [];
    for (const skill of catalog.skills)
      for (const artifact of skill.artifacts)
        if (artifact.kind === "script") scriptArtifacts.push({ skill, artifact });
    const behaviorsWithScripts = new Set(
      scriptArtifacts.map((entry) => entry.skill.behavior),
    );
    expect(behaviorsWithScripts.size).toBeGreaterThan(1);
    for (const { artifact } of scriptArtifacts)
      expect(["python", "shell", "javascript"]).toContain(artifact.language);
  });
  it("gives every page and every artifact a stable unique id", () => {
    const pageIds = catalog.pages.map((page) => page.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    const artifactIds = catalog.skills.flatMap((skill) =>
      skill.artifacts.map((artifact) => artifact.id),
    );
    expect(new Set(artifactIds).size).toBe(artifactIds.length);
  });
  it("returns a fresh object each call so callers cannot mutate the shared fixture", () => {
    const second = syntheticCatalog();
    expect(second).not.toBe(catalog);
    expect(second).toEqual(catalog);
  });
});
