import { afterEach, describe, expect, it, vi } from "vitest";
import { Store } from "../server/store.js";
import { Workspace } from "../server/domain.js";
import { DemoDispatcher } from "../server/demo.js";
const stores: Store[] = [];
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
    expect(() => workspace.startStage(next.id)).toThrow(/approved/);
    const tasks = workspace.startStage(first.id);
    tasks.forEach((task) =>
      workspace.recordResult(task.id, "completed", "Synthetic evidence"),
    );
    expect(() => workspace.startStage(next.id)).toThrow(/approved/);
    workspace.review(first.id, 1, "approve", "Reviewed both outputs");
    expect(workspace.tasks(next.id)).toHaveLength(0);
    expect(workspace.startStage(next.id)).toHaveLength(1);
  });
  it("claims once, storing separate identifiers and an immutable snapshot", () => {
    const { workspace, first } = fixture();
    const tasks = workspace.startStage(first.id);
    expect(workspace.startStage(first.id)).toEqual([]);
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
    const [task] = workspace.startStage(first.id);
    workspace.recordResult(task!.id, "unknown", "Connection lost");
    expect(() => workspace.review(first.id, 1, "approve", "Reviewed")).toThrow(
      /accounted/,
    );
  });
  it("requires evidence notes and current proposal revision", () => {
    const { workspace, first } = fixture();
    workspace
      .startStage(first.id)
      .forEach((task) =>
        workspace.recordResult(task.id, "completed", "Result"),
      );
    expect(() => workspace.review(first.id, 1, "approve", "")).toThrow();
    workspace.reviseStage(
      first.id,
      "Use route B",
      "Tides may change",
      "No winter data",
      "Route A",
    );
    expect(() =>
      workspace.review(first.id, 1, "approve", "Read outputs"),
    ).toThrow(/revision/);
    workspace.review(first.id, 2, "approve", "Read outputs");
    workspace.reviseStage(first.id, "Use route C", "", "", "");
    expect(workspace.stage(first.id).approvedRevision).toBeNull();
  });
  it("invalidates approvals after a context edit without changing launched snapshots", () => {
    const { workspace, project, first, next } = fixture();
    workspace
      .startStage(first.id)
      .forEach((task) =>
        workspace.recordResult(task.id, "completed", "Result"),
      );
    workspace.review(first.id, 1, "approve", "Read results");
    const item = workspace.context(project.id)[0]!;
    workspace.editContext(
      project.id,
      item.id,
      "constraint",
      "Avoid nesting sites.",
    );
    expect(() => workspace.startStage(next.id)).toThrow(/approved|stale/);
    expect(() => workspace.review(first.id, 1, "approve", "Read")).toThrow(
      /stale|revision/,
    );
    expect(workspace.snapshot(first.id).items[0]?.text).toBe(
      "Use public observations only.",
    );
  });
  it("request changes and rejection never release dependent work", () => {
    const { workspace, first, next } = fixture();
    workspace
      .startStage(first.id)
      .forEach((task) =>
        workspace.recordResult(task.id, "completed", "Result"),
      );
    workspace.review(first.id, 1, "changes", "Missing a tide table");
    expect(() => workspace.startStage(next.id)).toThrow(/approved/);
    workspace.review(first.id, 1, "reject", "Do not use this");
    expect(() => workspace.startStage(next.id)).toThrow(/approved/);
  });
  it("archive blocks new starts, promotion preserves provenance", () => {
    const { workspace, project, first } = fixture();
    workspace.updateProject(project.id, {
      lifetime: "long_term",
      status: "archived",
    });
    expect(workspace.project(project.id).version).toBe(2);
    expect(workspace.context(project.id)[0]?.source.messageId).toBe("m1");
    expect(() => workspace.startStage(first.id)).toThrow(/archived/);
  });
  it("runs bounded deterministic timers only after an explicit claim", async () => {
    vi.useFakeTimers();
    const { workspace, first, next } = fixture();
    const dispatcher = new DemoDispatcher(workspace);
    dispatcher.start(first.id);
    dispatcher.start(first.id);
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
    workspace.startStage(first.id);
    const bundle = workspace.exportProject(project.id);
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.context).toHaveLength(1);
    expect(JSON.stringify(bundle)).not.toMatch(
      /bootstrapToken|deviceToken|csrf|cookie|Authorization/,
    );
  });
});
