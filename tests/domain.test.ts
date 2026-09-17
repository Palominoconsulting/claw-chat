import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Store } from "../server/store.js";
import { Workspace } from "../server/domain.js";
import { DemoDispatcher } from "../server/demo.js";
const stores: Store[] = [];
// Existing sequential scenarios explicitly load the current preview/review state for each action.
// Competing-tab and delayed-delivery scenarios retain old contracts in authority.test.ts.
function launch(workspace: Workspace, id: string) {
  return workspace.startStage(
    id,
    workspace.stage(id).launchToken ?? workspace.previewStart(id).token,
  );
}
function reviewCurrent(
  workspace: Workspace,
  id: string,
  revision: number,
  action: "approve" | "changes" | "reject",
  note: string,
) {
  return workspace.review(
    id,
    revision,
    action,
    note,
    workspace.stage(id).reviewGeneration,
    randomUUID(),
  );
}
function reviseCurrent(
  workspace: Workspace,
  id: string,
  proposal: string,
  assumptions: string,
  missing: string,
  alternatives: string,
) {
  const stage = workspace.stage(id);
  return workspace.reviseStage(
    id,
    proposal,
    assumptions,
    missing,
    alternatives,
    { revision: stage.revision, generation: stage.reviewGeneration },
  );
}
function fixture() {
  const store = new Store(":memory:", "demo");
  stores.push(store);
  const workspace = new Workspace(store);
  const project = workspace.createProject("Harbor field guide", "short_term", [
    {
      text: "Use public observations only.",
      author: "Operator",
      source: {
        gateway: "demo",
        operator: "synthetic",
        sessionKey: "demo:harbor",
        sessionId: "demo-harbor-1",
        messageId: "m1",
      },
    },
  ]);
  const first = workspace.createStage(project.id, "Research", [
    { objective: "Observe tides", acceptance: "List observations" },
    { objective: "Compare paths", acceptance: "List tradeoffs" },
  ]);
  const next = workspace.createStage(project.id, "Draft", [
    { objective: "Draft guide", acceptance: "Use reviewed observations" },
  ]);
  return { store, workspace, project, first, next };
}
afterEach(() => {
  stores.splice(0).forEach((store) => store.close());
  vi.useRealTimers();
});
describe("managed-stage admission", () => {
  it("dispatches nothing for a dependent stage without approval and separate start", () => {
    const { workspace, first, next } = fixture();
    expect(() => launch(workspace, next.id)).toThrow(/approved/);
    const tasks = launch(workspace, first.id);
    tasks.forEach((task) =>
      workspace.recordResult(task.id, "completed", "Synthetic evidence"),
    );
    expect(() => launch(workspace, next.id)).toThrow(/approved/);
    reviewCurrent(workspace, first.id, 1, "approve", "Reviewed both outputs");
    expect(workspace.tasks(next.id)).toHaveLength(0);
    expect(launch(workspace, next.id)).toHaveLength(1);
  });
  it("claims once, storing separate identifiers and an immutable snapshot", () => {
    const { workspace, first } = fixture();
    const tasks = launch(workspace, first.id);
    expect(launch(workspace, first.id)).toEqual([]);
    expect(
      new Set([
        tasks[0]?.id,
        tasks[0]?.runId,
        tasks[0]?.sessionId,
        tasks[0]?.idempotencyKey,
      ]).size,
    ).toBe(4);
    expect(workspace.snapshot(first.id).items[0]?.text).toBe(
      "Use public observations only.",
    );
  });
  it("blocks unaccounted-for and unknown work", () => {
    const { workspace, first } = fixture();
    const [task] = launch(workspace, first.id);
    workspace.recordResult(task!.id, "unknown", "Connection lost");
    expect(() =>
      reviewCurrent(workspace, first.id, 1, "approve", "Reviewed"),
    ).toThrow(/accounted/);
  });
  it("requires evidence notes and current proposal revision", () => {
    const { workspace, first } = fixture();
    launch(workspace, first.id).forEach((task) =>
      workspace.recordResult(task.id, "completed", "Result"),
    );
    expect(() =>
      reviewCurrent(workspace, first.id, 1, "approve", ""),
    ).toThrow();
    reviseCurrent(
      workspace,
      first.id,
      "Use route B",
      "Tides may change",
      "No winter data",
      "Route A",
    );
    expect(() =>
      reviewCurrent(workspace, first.id, 1, "approve", "Read outputs"),
    ).toThrow(/revision/);
    reviewCurrent(workspace, first.id, 2, "approve", "Read outputs");
    reviseCurrent(workspace, first.id, "Use route C", "", "", "");
    expect(workspace.stage(first.id).approvedRevision).toBeNull();
  });
  it("invalidates approvals after a context edit without changing launched snapshots", () => {
    const { workspace, project, first, next } = fixture();
    launch(workspace, first.id).forEach((task) =>
      workspace.recordResult(task.id, "completed", "Result"),
    );
    reviewCurrent(workspace, first.id, 1, "approve", "Read results");
    const item = workspace.context(project.id)[0]!;
    workspace.editContext(
      project.id,
      item.id,
      "constraint",
      "Avoid nesting sites.",
    );
    expect(() => launch(workspace, next.id)).toThrow(/approved|stale/);
    expect(() =>
      reviewCurrent(workspace, first.id, 1, "approve", "Read"),
    ).toThrow(/stale|revision/);
    expect(workspace.snapshot(first.id).items[0]?.text).toBe(
      "Use public observations only.",
    );
  });
  it("request changes and rejection never release dependent work", () => {
    const { workspace, first, next } = fixture();
    launch(workspace, first.id).forEach((task) =>
      workspace.recordResult(task.id, "completed", "Result"),
    );
    reviewCurrent(workspace, first.id, 1, "changes", "Missing a tide table");
    expect(() => launch(workspace, next.id)).toThrow(/approved/);
    reviewCurrent(workspace, first.id, 1, "reject", "Do not use this");
    expect(() => launch(workspace, next.id)).toThrow(/approved/);
  });
  it("archive blocks new starts, promotion preserves provenance", () => {
    const { workspace, project, first } = fixture();
    workspace.updateProject(project.id, {
      lifetime: "long_term",
      status: "archived",
    });
    expect(workspace.project(project.id).version).toBe(2);
    expect(workspace.context(project.id)[0]?.source.messageId).toBe("m1");
    expect(() => launch(workspace, first.id)).toThrow(/archived/);
  });
  it("runs bounded deterministic timers only after an explicit claim", async () => {
    vi.useFakeTimers();
    const { workspace, first, next } = fixture();
    const dispatcher = new DemoDispatcher(workspace);
    dispatcher.start(first.id, workspace.previewStart(first.id).token);
    dispatcher.start(first.id, workspace.previewStart(first.id).token);
    await vi.runAllTimersAsync();
    expect(workspace.tasks(first.id).map((task) => task.status)).toEqual([
      "completed",
      "completed",
    ]);
    expect(workspace.tasks(next.id)).toHaveLength(0);
    dispatcher.close();
  });
  it("exports only project-owned data in a versioned envelope", () => {
    const { workspace, project, first } = fixture();
    launch(workspace, first.id);
    const bundle = workspace.exportProject(project.id);
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.context).toHaveLength(1);
    expect(JSON.stringify(bundle)).not.toMatch(
      /bootstrapToken|deviceToken|csrf|cookie|Authorization/,
    );
  });
});
it("saves a catalog reference as an immutable context item distinct from a chat excerpt", () => {
  const { workspace, project } = fixture();
  workspace.addContext(project.id, [
    {
      text: "Synthetic wiki fixture: keep excerpts source-linked.",
      author: "Wiki catalog",
      source: {
        gateway: "catalog",
        operator: "local",
        sessionKey: "wiki:demo-page",
        sessionId: "demo-page",
        messageId: "demo-page",
      },
    },
  ]);
  const items = workspace.context(project.id);
  const catalogItem = items.find(
    (item) => item.source.gateway === "catalog",
  )!;
  expect(catalogItem).toBeTruthy();
  expect(catalogItem.kind).toBe("catalog_reference");
});
it("rejects rewriting catalog_reference text without first recategorizing, same as a chat excerpt", () => {
  const { workspace, project } = fixture();
  workspace.addContext(project.id, [
    {
      text: "Synthetic skill fixture body.",
      author: "Skill catalog",
      source: {
        gateway: "catalog",
        operator: "local",
        sessionKey: "skill:demo-skill",
        sessionId: "demo-skill",
        messageId: "demo-skill:instructions",
      },
    },
  ]);
  const item = workspace
    .context(project.id)
    .find((entry) => entry.source.gateway === "catalog")!;
  workspace.editContext(
    project.id,
    item.id,
    "catalog_reference",
    item.originalText!,
  );
  expect(
    workspace.context(project.id).find((entry) => entry.id === item.id)?.kind,
  ).toBe("catalog_reference");
  expect(() =>
    workspace.editContext(
      project.id,
      item.id,
      "catalog_reference",
      "Rewritten text pretending to be the original.",
    ),
  ).toThrow(/immutable/);
  workspace.editContext(
    project.id,
    item.id,
    "note",
    "My note about the fixture, safe to edit.",
  );
  expect(
    workspace.context(project.id).find((entry) => entry.id === item.id)
      ?.originalText,
  ).toBe("Synthetic skill fixture body.");
});
it("retains original captured excerpt when the operator creates an interpretation", () => {
  const { workspace, project } = fixture();
  const item = workspace.context(project.id)[0]!;
  workspace.editContext(
    project.id,
    item.id,
    "note",
    "My interpretation is more limited.",
  );
  expect(workspace.context(project.id)[0]?.originalText).toBe(
    "Use public observations only.",
  );
  expect(workspace.context(project.id)[0]?.originalHash).toBe(item.hash);
});
it("requires explicit confirmation to abandon interrupted demo work, without retry or false success", () => {
  const { workspace, first, project } = fixture();
  launch(workspace, first.id);
  workspace.recover();
  expect(() => workspace.reconcileDemo(first.id, "")).toThrow();
  workspace.reconcileDemo(
    first.id,
    "The stopped demo timers cannot run. Abandon these outputs.",
  );
  expect(workspace.tasks(first.id).map((task) => task.status)).toEqual([
    "failed",
    "failed",
  ]);
  expect(workspace.stage(first.id).status).toBe("rejected");
  expect(workspace.project(project.id)).toBeDefined();
  expect(launch(workspace, first.id)).toEqual([]);
});
it("rejects recognizable credential material before it can reach SQLite or an export", () => {
  const { workspace } = fixture();
  expect(() =>
    workspace.createProject("Bad paste", "short_term", [
      {
        text: "Authorization: Bearer synthetic-secret-value-123456",
        author: "Test",
        source: {
          gateway: "demo",
          operator: "test",
          sessionKey: "test",
          sessionId: "instance",
          messageId: "m1",
        },
      },
    ]),
  ).toThrow(/credential/);
  expect(workspace.store.all("projects")).toHaveLength(1);
});
it("database enforces append-only review events and immutable snapshots", () => {
  const { workspace, first } = fixture();
  launch(workspace, first.id).forEach((task) =>
    workspace.recordResult(task.id, "completed", "Synthetic result"),
  );
  reviewCurrent(workspace, first.id, 1, "approve", "Both results checked");
  const snapshot = workspace.snapshot(first.id);
  expect(() =>
    workspace.store.put(
      "snapshots",
      { ...snapshot, digest: "tampered" },
      { project_id: snapshot.projectId },
    ),
  ).toThrow(/immutable/);
  expect(() => workspace.store.db.exec("UPDATE events SET data=data")).toThrow(
    /append-only/,
  );
});
