import { describe, expect, it } from "vitest";
import type { Project, Stage, Task, WorkspaceState } from "../shared/types.js";
import { guidedProgress } from "../src/lib/guidedDemo.js";
import type { GuideRun } from "../src/lib/guidedDemo.js";

const project: Project = {
  id: "practice",
  name: "Practice",
  lifetime: "short_term",
  status: "active",
  version: 1,
  contextVersion: 1,
  createdAt: "2026-09-14T00:00:00Z",
};
const stage: Stage = {
  id: "first",
  projectId: project.id,
  position: 0,
  title: "Observe",
  briefs: [{ objective: "Observe", acceptance: "Cite context" }],
  status: "draft",
  revision: 1,
  approvedRevision: null,
  reviewGeneration: 0,
  launchToken: null,
  dependencies: [],
  dependencyStale: false,
  snapshotId: null,
  contextVersion: null,
  proposal: "",
  assumptions: "",
  missing: "",
  alternatives: "",
  createdAt: project.createdAt,
};
const task: Task = {
  id: "output",
  stageId: stage.id,
  runId: "run",
  sessionId: "session",
  sessionKey: "demo:task",
  idempotencyKey: "once",
  snapshotId: "snapshot",
  objective: "Observe",
  acceptance: "Cite context",
  status: "completed",
  output: "Synthetic output",
  createdAt: project.createdAt,
};
function fixture(): { state: WorkspaceState; run: GuideRun } {
  return {
    state: {
      projects: [project],
      stages: [],
      tasks: [],
      events: [],
      conversations: [],
      connection: {
        mode: "demo",
        state: "demo",
        detail: "Synthetic",
        canExecute: true,
      },
      context: [
        {
          id: "excerpt",
          projectId: project.id,
          kind: "source_excerpt",
          text: "Synthetic",
          author: "Demo",
          hash: "hash",
          originalText: null,
          originalHash: null,
          capturedAt: project.createdAt,
          version: 1,
          source: {
            gateway: "demo",
            operator: "demo",
            sessionKey: "demo:harbor",
            sessionId: "harbor",
            messageId: "m1",
          },
        },
      ],
    },
    run: {
      baselineProjectIds: ["unrelated"],
      projectId: project.id,
      sourceMessageIds: ["m1"],
      inspectedTaskIds: [],
    },
  };
}
function results() {
  const f = fixture();
  f.state.stages = [
    {
      ...stage,
      status: "review",
      snapshotId: task.snapshotId,
      contextVersion: 1,
    },
  ];
  f.state.tasks = [task];
  return f;
}
function approved() {
  const f = results();
  f.run.inspectedTaskIds = [task.id];
  f.state.stages[0] = {
    ...f.state.stages[0]!,
    status: "approved",
    approvedRevision: 1,
    reviewGeneration: 1,
  };
  f.state.events = [
    {
      id: "human-review",
      stageId: stage.id,
      revision: 1,
      action: "approve",
      generation: 0,
      note: "Examined",
      createdAt: project.createdAt,
    },
  ];
  return f;
}
describe("guided demo observes actual state, never grants authority", () => {
  it("starts with selection and advances only when messages are selected", () => {
    const { state, run } = fixture();
    run.projectId = null;
    expect(guidedProgress(state, run, []).step).toBe("select");
    expect(guidedProgress(state, run, ["m1"]).step).toBe("create-project");
  });
  it("is disabled in live mode", () => {
    const { state, run } = approved();
    state.connection.mode = "live";
    expect(guidedProgress(state, run, []).step).toBe("unavailable");
  });
  it("cannot borrow a preexisting project, even one with approved work", () => {
    const { state, run } = approved();
    run.baselineProjectIds.push(project.id);
    expect(guidedProgress(state, run, []).step).toBe("select");
  });
  it("requires the saved sample excerpt, not merely a new project", () => {
    const { state, run } = fixture();
    state.context = [];
    expect(guidedProgress(state, run, []).step).toBe("blocked");
  });
  it("follows creation, explicit start, and completion of the first stage", () => {
    const { state, run } = fixture();
    expect(guidedProgress(state, run, []).step).toBe("create-stage");
    state.stages = [stage];
    expect(guidedProgress(state, run, []).step).toBe("start-stage");
    state.stages[0] = { ...stage, status: "running", contextVersion: 1 };
    state.tasks = [{ ...task, status: "running" }];
    expect(guidedProgress(state, run, []).step).toBe("wait");
  });
  it("requires every actual output to be inspected, even after approval", () => {
    const { state, run } = approved();
    run.inspectedTaskIds = ["unrelated-output"];
    expect(guidedProgress(state, run, []).step).toBe("inspect");
    run.inspectedTaskIds = [task.id];
    expect(guidedProgress(state, run, []).step).toBe("create-successor");
  });
  it("does not count missing, failed, unknown or empty outputs as results", () => {
    for (const status of ["failed", "unknown"] as const) {
      const { state, run } = results();
      state.tasks[0] = { ...task, status };
      expect(guidedProgress(state, run, []).step).toBe("blocked");
    }
    const { state, run } = results();
    state.tasks = [];
    expect(guidedProgress(state, run, []).step).toBe("blocked");
    state.tasks = [{ ...task, output: "" }];
    expect(guidedProgress(state, run, []).step).toBe("blocked");
  });
  it("requires a human event for the exact approved revision and current context", () => {
    const { state, run } = approved();
    state.events[0] = { ...state.events[0]!, generation: 7 };
    expect(guidedProgress(state, run, []).step).toBe("review");
    state.events = [];
    expect(guidedProgress(state, run, []).step).toBe("review");
    state.events = [
      {
        id: "old",
        stageId: stage.id,
        revision: 0,
        action: "approve",
        note: "old",
        createdAt: project.createdAt,
      },
    ];
    expect(guidedProgress(state, run, []).step).toBe("review");
    state.stages[0] = { ...state.stages[0]!, contextVersion: 0 };
    expect(guidedProgress(state, run, []).step).toBe("stale");
  });
  it("keeps changes and rejection visible instead of pushing approval", () => {
    for (const status of ["changes", "rejected"] as const) {
      const { state, run } = approved();
      state.stages[0] = { ...state.stages[0]!, status, approvedRevision: null };
      expect(guidedProgress(state, run, []).step).toBe(status);
    }
  });
  it("approval alone cannot complete the flow; successor needs actual dispatched tasks", () => {
    const { state, run } = approved();
    const successor = { ...stage, id: "next", position: 1 };
    state.stages.push(successor);
    expect(guidedProgress(state, run, []).step).toBe("start-successor");
    state.stages[1] = {
      ...successor,
      status: "running",
      snapshotId: "next-snapshot",
      contextVersion: 1,
    };
    expect(guidedProgress(state, run, []).step).toBe("start-successor");
    state.tasks.push({
      ...task,
      id: "next-task",
      stageId: "next",
      snapshotId: "next-snapshot",
      status: "running",
    });
    expect(guidedProgress(state, run, []).step).toBe("complete");
  });
  it("ignores unrelated stages, tasks and approvals and never mutates input", () => {
    const { state, run } = fixture();
    state.stages = [
      {
        ...stage,
        projectId: "unrelated",
        status: "approved",
        approvedRevision: 1,
      },
    ];
    state.tasks = [task];
    const before = JSON.stringify({ state, run });
    expect(guidedProgress(state, run, []).step).toBe("create-stage");
    expect(JSON.stringify({ state, run })).toBe(before);
  });
  it("will not advance an archived or removed project", () => {
    const { state, run } = approved();
    state.projects = [{ ...project, status: "archived" }];
    expect(guidedProgress(state, run, []).step).toBe("blocked");
    state.projects = [];
    expect(guidedProgress(state, run, []).step).toBe("blocked");
  });
});
