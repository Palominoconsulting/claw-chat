import { createHash, randomUUID } from "node:crypto";
import type {
  ContextItem,
  ContextKind,
  Excerpt,
  Lifetime,
  Project,
  ProjectBundle,
  ReviewEvent,
  Snapshot,
  Stage,
  Task,
  TaskBrief,
} from "../shared/types.js";
import type { Store } from "./store.js";
export const now = () => new Date().toISOString();
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
function text(value: string, max = 20000) {
  if (!value.trim() || value.length > max)
    throw new Error(`Text must contain 1–${max} characters`);
  return value;
}
export class Workspace {
  constructor(readonly store: Store) {}
  project(id: string) {
    return this.store.get<Project>("projects", id);
  }
  context(id: string) {
    return this.store.all<ContextItem>("context_items", {
      column: "project_id",
      value: id,
    });
  }
  stages(id?: string) {
    return this.store.all<Stage>(
      "stages",
      id ? { column: "project_id", value: id } : undefined,
    );
  }
  stage(id: string) {
    return this.store.get<Stage>("stages", id);
  }
  tasks(id?: string) {
    return this.store.all<Task>(
      "tasks",
      id ? { column: "stage_id", value: id } : undefined,
    );
  }
  snapshot(stageId: string) {
    const stage = this.stage(stageId);
    if (!stage.snapshotId) throw new Error("Stage has not started");
    return this.store.get<Snapshot>("snapshots", stage.snapshotId);
  }
  createProject(
    name: string,
    lifetime: Lifetime,
    excerpts: Excerpt[],
  ): Project {
    return this.store.transaction(() => {
      const project: Project = {
        id: randomUUID(),
        name: text(name, 120),
        lifetime,
        status: "active",
        version: 1,
        contextVersion: 1,
        createdAt: now(),
      };
      this.store.put("projects", project);
      excerpts.forEach((excerpt) => this.insertContext(project.id, excerpt));
      return project;
    });
  }
  private insertContext(projectId: string, excerpt: Excerpt) {
    const item: ContextItem = {
      ...excerpt,
      text: text(excerpt.text),
      id: randomUUID(),
      projectId,
      kind: "source_excerpt",
      hash: digest(excerpt.text),
      capturedAt: now(),
      version: 1,
    };
    this.store.put("context_items", item, { project_id: projectId });
  }
  addContext(projectId: string, excerpts: Excerpt[]) {
    this.store.transaction(() => {
      this.assertActive(projectId);
      excerpts.forEach((excerpt) => this.insertContext(projectId, excerpt));
      this.contextChanged(projectId);
    });
  }
  editContext(projectId: string, id: string, kind: ContextKind, value: string) {
    this.store.transaction(() => {
      this.assertActive(projectId);
      const item = this.store.get<ContextItem>("context_items", id);
      if (item.projectId !== projectId)
        throw new Error("Context does not belong to project");
      // Captured source excerpts remain exact. An edited note must not impersonate original speech.
      if (kind === "source_excerpt" && value !== item.text)
        throw new Error(
          "Source excerpt text is immutable; change kind to note first",
        );
      this.store.put(
        "context_items",
        {
          ...item,
          kind,
          text: text(value),
          hash: digest(value),
          version: item.version + 1,
        },
        { project_id: projectId },
      );
      this.contextChanged(projectId);
    });
  }
  private contextChanged(id: string) {
    const project = this.project(id);
    this.store.put("projects", {
      ...project,
      version: project.version + 1,
      contextVersion: project.contextVersion + 1,
    });
    this.stages(id).forEach((stage) => {
      if (stage.snapshotId) {
        this.store.put(
          "stages",
          {
            ...stage,
            approvedRevision: null,
            status: stage.status === "approved" ? "review" : stage.status,
          },
          { project_id: id, position: stage.position },
        );
        this.event(
          stage,
          "context_changed",
          "Context changed; launched snapshot retained. Start a new project for revised execution.",
        );
      }
    });
  }
  updateProject(
    id: string,
    patch: Partial<Pick<Project, "lifetime" | "status" | "name">>,
  ) {
    const project = this.project(id);
    this.store.put("projects", {
      ...project,
      ...patch,
      version: project.version + 1,
    });
    return this.project(id);
  }
  createStage(projectId: string, title: string, briefs: TaskBrief[]) {
    this.assertActive(projectId);
    if (briefs.length < 1 || briefs.length > 4)
      throw new Error("A stage requires 1–4 independent tasks");
    if (this.stages(projectId).length >= 20)
      throw new Error("Maximum 20 stages per project");
    briefs.forEach((brief) => {
      text(brief.objective, 2000);
      text(brief.acceptance, 2000);
    });
    const stage: Stage = {
      id: randomUUID(),
      projectId,
      title: text(title, 120),
      position: this.stages(projectId).length,
      briefs,
      status: "draft",
      revision: 1,
      approvedRevision: null,
      snapshotId: null,
      contextVersion: null,
      proposal:
        "Review all outputs and record a proposal before accepting this stage.",
      assumptions: "",
      missing: "",
      alternatives: "",
      createdAt: now(),
    };
    this.store.put("stages", stage, {
      project_id: projectId,
      position: stage.position,
    });
    return stage;
  }
  private assertActive(id: string) {
    const project = this.project(id);
    if (project.status === "archived") throw new Error("Project is archived");
    return project;
  }
  startStage(id: string): Task[] {
    return this.store.transaction(() => {
      const stage = this.stage(id);
      const project = this.assertActive(stage.projectId);
      if (stage.status !== "draft") return [];
      const predecessor = this.stages(project.id).find(
        (other) => other.position === stage.position - 1,
      );
      if (
        predecessor &&
        (predecessor.status !== "approved" ||
          predecessor.approvedRevision !== predecessor.revision ||
          predecessor.contextVersion !== project.contextVersion)
      )
        throw new Error(
          "Previous stage must have a current, non-stale approved revision",
        );
      if (
        this.tasks().some(
          (task) => task.status === "running" || task.status === "unknown",
        )
      )
        throw new Error(
          "Account for active or unknown work before starting another stage",
        );
      const items = this.context(project.id);
      if (items.length === 0) throw new Error("Select context before starting");
      if (JSON.stringify(items).length > 100000)
        throw new Error(
          "Context packet exceeds 100,000 characters; curate a smaller project",
        );
      const snapshot: Snapshot = {
        id: randomUUID(),
        projectId: project.id,
        contextVersion: project.contextVersion,
        items,
        digest: digest(JSON.stringify(items)),
        createdAt: now(),
      };
      this.store.put("snapshots", snapshot, { project_id: project.id });
      this.store.put(
        "stages",
        {
          ...stage,
          status: "running",
          snapshotId: snapshot.id,
          contextVersion: project.contextVersion,
        },
        { project_id: project.id, position: stage.position },
      );
      const tasks = stage.briefs.map((brief) => {
        const sessionId = randomUUID();
        const task: Task = {
          ...brief,
          id: randomUUID(),
          stageId: id,
          runId: randomUUID(),
          sessionId,
          sessionKey: `claw-chat:demo:${sessionId}`,
          idempotencyKey: randomUUID(),
          snapshotId: snapshot.id,
          status: "running",
          output: "",
          createdAt: now(),
        };
        this.store.put("tasks", task, {
          stage_id: id,
          idempotency_key: task.idempotencyKey,
        });
        return task;
      });
      return tasks;
    });
  }
  recordResult(
    taskId: string,
    status: "completed" | "failed" | "unknown",
    output: string,
  ) {
    this.store.transaction(() => {
      const task = this.store.get<Task>("tasks", taskId);
      if (task.status !== "running")
        throw new Error(
          "Terminal or unknown work cannot be overwritten; reconcile explicitly",
        );
      this.store.put(
        "tasks",
        { ...task, status, output: text(output) },
        { stage_id: task.stageId, idempotency_key: task.idempotencyKey },
      );
      const stage = this.stage(task.stageId);
      const tasks = this.tasks(stage.id);
      if (tasks.every((item) => item.status !== "running"))
        this.store.put(
          "stages",
          {
            ...stage,
            status: tasks.every((item) => item.status === "completed")
              ? "review"
              : "unknown",
          },
          { project_id: stage.projectId, position: stage.position },
        );
    });
  }
  recover() {
    this.tasks()
      .filter((task) => task.status === "running")
      .forEach((task) =>
        this.recordResult(
          task.id,
          "unknown",
          "Process stopped before acknowledgement. Not retried. Reconciliation required.",
        ),
      );
  }
  reviseStage(
    id: string,
    proposal: string,
    assumptions: string,
    missing: string,
    alternatives: string,
  ) {
    this.store.transaction(() => {
      const stage = this.stage(id);
      if (!["review", "approved", "changes", "rejected"].includes(stage.status))
        throw new Error("Wait for all results before revising the proposal");
      this.store.put(
        "stages",
        {
          ...stage,
          proposal: text(proposal),
          assumptions,
          missing,
          alternatives,
          revision: stage.revision + 1,
          approvedRevision: null,
          status: "review",
        },
        { project_id: stage.projectId, position: stage.position },
      );
      this.event(
        this.stage(id),
        "revise",
        "Operator revised the proposal; previous approval invalidated",
      );
    });
  }
  review(
    id: string,
    revision: number,
    action: "approve" | "changes" | "reject",
    note: string,
  ) {
    this.store.transaction(() => {
      text(note, 4000);
      const stage = this.stage(id);
      const project = this.assertActive(stage.projectId);
      if (stage.revision !== revision)
        throw new Error("Review revision has changed; reload");
      if (stage.contextVersion !== project.contextVersion)
        throw new Error(
          "Context is stale. A new execution project is required; old work is not re-certified.",
        );
      const tasks = this.tasks(id);
      if (
        tasks.length !== stage.briefs.length ||
        tasks.some((task) => task.status !== "completed")
      )
        throw new Error(
          "All work must be accounted for with completed evidence",
        );
      this.store.put(
        "stages",
        {
          ...stage,
          status:
            action === "approve"
              ? "approved"
              : action === "changes"
                ? "changes"
                : "rejected",
          approvedRevision: action === "approve" ? revision : null,
        },
        { project_id: project.id, position: stage.position },
      );
      this.event(stage, action, note);
    });
  }
  private event(stage: Stage, action: ReviewEvent["action"], note: string) {
    this.store.put(
      "events",
      {
        id: randomUUID(),
        stageId: stage.id,
        revision: stage.revision,
        action,
        note,
        createdAt: now(),
      },
      { stage_id: stage.id },
    );
  }
  exportProject(id: string): ProjectBundle {
    const stages = this.stages(id);
    const ids = new Set(stages.map((stage) => stage.id));
    return {
      formatVersion: 1,
      exportedAt: now(),
      project: this.project(id),
      context: this.context(id),
      stages,
      tasks: this.tasks().filter((task) => ids.has(task.stageId)),
      snapshots: this.store.all<Snapshot>("snapshots", {
        column: "project_id",
        value: id,
      }),
      events: this.store
        .all<ReviewEvent>("events")
        .filter((event) => ids.has(event.stageId)),
    };
  }
}
