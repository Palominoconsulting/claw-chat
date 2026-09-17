import type { WorkspaceState } from "../../shared/types.js";

// UI observation only. Never persist source text, grant approval, or dispatch work.
export const GUIDE_PREFERENCE = "claw-chat.guided-demo";
export interface GuideRun {
  baselineProjectIds: string[];
  projectId: string | null;
  sourceMessageIds: string[];
  inspectedTaskIds: string[];
}
export type GuideStep =
  | "unavailable"
  | "select"
  | "create-project"
  | "create-stage"
  | "start-stage"
  | "wait"
  | "inspect"
  | "review"
  | "changes"
  | "rejected"
  | "stale"
  | "blocked"
  | "create-successor"
  | "start-successor"
  | "complete";
export interface GuideProgress {
  step: GuideStep;
  // Six actions: select, save project, start stage, inspect, review, start successor.
  completed: number;
}
export function guidedProgress(
  state: WorkspaceState,
  run: GuideRun,
  selectedMessageIds: string[],
): GuideProgress {
  const at = (step: GuideStep, completed: number): GuideProgress => ({
    step,
    completed,
  });
  if (state.connection.mode !== "demo") return at("unavailable", 0);
  const project = state.projects.find(
    (item) =>
      item.id === run.projectId && !run.baselineProjectIds.includes(item.id),
  );
  const hasSource =
    project &&
    state.context.some(
      (item) =>
        item.projectId === project.id &&
        item.kind === "source_excerpt" &&
        item.source.sessionKey === "demo:harbor" &&
        run.sourceMessageIds.includes(item.source.messageId),
    );
  if (project && !hasSource) return at("blocked", 1);
  if (!project) {
    if (run.projectId && !run.baselineProjectIds.includes(run.projectId))
      return at("blocked", 0);
    return selectedMessageIds.length
      ? at("create-project", 1)
      : at("select", 0);
  }
  if (project.status !== "active") return at("blocked", 2);
  const stages = state.stages
    .filter((item) => item.projectId === project.id)
    .toSorted((a, b) => a.position - b.position);
  const first = stages[0];
  if (!first) return at("create-stage", 2);
  if (first.status === "draft") return at("start-stage", 2);
  if (first.contextVersion !== project.contextVersion || first.dependencyStale)
    return at("stale", 3);
  const tasks = state.tasks.filter((item) => item.stageId === first.id);
  if (
    first.status === "unknown" ||
    tasks.some((item) => ["failed", "unknown"].includes(item.status))
  )
    return at("blocked", 3);
  if (
    first.status === "running" ||
    tasks.some((item) => item.status === "running")
  )
    return at("wait", 3);
  if (
    !tasks.length ||
    tasks.length !== first.briefs.length ||
    tasks.some(
      (item) =>
        item.status !== "completed" ||
        !item.output ||
        item.snapshotId !== first.snapshotId,
    )
  )
    return at("blocked", 3);
  const inspected = tasks.every((item) =>
    run.inspectedTaskIds.includes(item.id),
  );
  if (first.status === "changes") return at("changes", inspected ? 4 : 3);
  if (first.status === "rejected") return at("rejected", inspected ? 4 : 3);
  if (!inspected) return at("inspect", 3);
  const approved =
    first.status === "approved" &&
    first.approvedRevision === first.revision &&
    state.events.some(
      (event) =>
        event.stageId === first.id &&
        event.revision === first.revision &&
        event.generation === first.reviewGeneration - 1 &&
        event.action === "approve",
    );
  if (!approved) return at("review", 4);
  const successor = stages[1];
  if (!successor) return at("create-successor", 5);
  if (successor.dependencyStale) return at("stale", 5);
  const successorTasks = state.tasks.filter(
    (item) => item.stageId === successor.id,
  );
  if (
    successor.status === "unknown" ||
    successorTasks.some((item) => ["failed", "unknown"].includes(item.status))
  )
    return at("blocked", 5);
  if (
    successor.status === "draft" ||
    !successor.snapshotId ||
    successor.contextVersion !== project.contextVersion ||
    !successorTasks.length ||
    successorTasks.length !== successor.briefs.length ||
    successorTasks.some((item) => item.snapshotId !== successor.snapshotId)
  )
    return at("start-successor", 5);
  return at("complete", 6);
}
