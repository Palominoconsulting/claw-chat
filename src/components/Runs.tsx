import type { LobsterSounds } from "../lib/useLobsterSounds.js";
/* Stage task position is the immutable identity within a fixed stage; form values are fully controlled. */
/* eslint-disable react/no-array-index-key */
import { useEffect, useRef, useState } from "react";
import type {
  ContextItem,
  StartPreview,
  Project,
  Stage,
  Task,
  TaskBrief,
} from "../../shared/types.js";
import { api } from "../lib/api.js";
import { Button, Icon, Tag } from "./Primitives.js";
interface Props {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  context: ContextItem[];
  demo: boolean;
  busy: boolean;
  mutate: (
    fn: () => Promise<unknown>,
    onConfirmed?: () => void,
  ) => Promise<void>;
  soundAction: LobsterSounds["action"];
  onReviewing: (reviewing: boolean) => void;
  inspect: (task: Task) => void;
  review: () => void;
}
export function Runs({
  project,
  stages,
  tasks,
  demo,
  busy,
  mutate,
  inspect,
  review,
  soundAction,
  onReviewing,
}: Props) {
  const [adding, setAdding] = useState(stages.length === 0);
  const [formReveal, setFormReveal] = useState(0);
  const [createdStageId, setCreatedStageId] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!adding || !formReveal) return;
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      titleRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [adding, formReveal]);
  useEffect(() => {
    if (!createdStageId || !stages.some((stage) => stage.id === createdStageId))
      return;
    const frame = requestAnimationFrame(() => {
      const section = contentRef.current?.querySelector<HTMLElement>(
        `[data-stage-id="${CSS.escape(createdStageId)}"]`,
      );
      const button = section?.querySelector<HTMLButtonElement>(
        ".stage-footer button",
      );
      button?.scrollIntoView({ block: "center" });
      button?.focus({ preventScroll: true });
      setCreatedStageId("");
    });
    return () => cancelAnimationFrame(frame);
  }, [createdStageId, stages]);
  const [title, setTitle] = useState("Observe & compare");
  const [briefs, setBriefs] = useState<TaskBrief[]>([
    {
      objective: "Collect tidal observations from the selected context",
      acceptance: "Separate observations from assumptions",
    },
    {
      objective: "Compare the two walking routes",
      acceptance: "Describe tradeoffs without inventing facts",
    },
  ]);
  const [preview, setPreview] = useState<StartPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    onReviewing(Boolean(preview));
    return () => onReviewing(false);
  }, [preview, onReviewing]);
  useEffect(() => {
    if (!preview) return;
    const frame = requestAnimationFrame(() => {
      const heading =
        contentRef.current?.querySelector<HTMLElement>(".launch-preview h3");
      heading?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [preview]);
  function change(index: number, field: keyof TaskBrief, value: string) {
    setBriefs(
      briefs.map((brief, i) =>
        i === index ? { ...brief, [field]: value } : brief,
      ),
    );
  }
  return (
    <div className="content-view" ref={contentRef}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Bounded work, deliberate starts</span>
          <h2>One stage at a time.</h2>
        </div>
        <Button
          ref={addRef}
          isDisabled={project.status === "archived" || !demo}
          aria-expanded={adding}
          aria-controls="stage-form"
          onPress={() => {
            setAdding(true);
            setFormReveal((value) => value + 1);
          }}
        >
          + Add stage
        </Button>
      </div>
      <p className="lede">
        Up to four independent tasks run together. The next stage stays locked
        until you approve the current revision, then explicitly start it.
      </p>
      <p className="fine-print">
        App-managed tasks only. This does not pause arbitrary Gateway agents or
        replace runtime tool approvals.
      </p>
      {preview && (
        <section className="launch-preview" aria-label="Launch preview">
          <div className="section-heading">
            <h3 tabIndex={-1}>Review the launch packet</h3>
            <Button variant="ghost" onPress={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
          <p>
            <strong>{preview.stage.title}</strong> ·{" "}
            {preview.stage.briefs.length} tasks ·{" "}
            {preview.items
              .reduce((sum, item) => sum + item.text.length, 0)
              .toLocaleString()}{" "}
            excerpt characters · context v{preview.contextVersion}
          </p>
          <details open>
            <summary>Exact selected context</summary>
            {preview.items.map((item) => (
              <blockquote key={item.id}>
                <Tag>{item.kind.replaceAll("_", " ")}</Tag>
                <p>{item.text}</p>
              </blockquote>
            ))}
          </details>
          <ul>
            {preview.stage.briefs.map((brief, index) => (
              <li key={index}>
                <strong>{brief.objective}</strong>
                <p>Acceptance: {brief.acceptance}</p>
              </li>
            ))}
          </ul>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I reviewed the tasks and this exact packet.
          </label>
          <Button
            variant="primary"
            isDisabled={!confirmed || busy}
            onPress={() => {
              const sound = soundAction();
              let started: Task[] = [];
              void mutate(
                async () => {
                  const result = await api<{ tasks: Task[] }>(
                    `/stages/${preview.stage.id}/start`,
                    {
                      token: preview.token,
                    },
                  );
                  started = result.tasks;
                  setPreview(null);
                },
                () => sound.started(started),
              );
            }}
          >
            Start simulated stage
          </Button>
          <small>
            No Gateway or model calls. The packet is snapshotted when admitted.
          </small>
        </section>
      )}
      {stages.map((stage, index) => {
        const predecessor = stages[index - 1];
        const eligible =
          !stage.dependencyStale &&
          (!predecessor ||
            (predecessor.status === "approved" &&
              predecessor.approvedRevision === predecessor.revision &&
              predecessor.contextVersion === project.contextVersion &&
              !predecessor.dependencyStale));
        const stale =
          stage.dependencyStale ||
          (stage.contextVersion !== null &&
            stage.contextVersion !== project.contextVersion);
        return (
          <section className="stage" data-stage-id={stage.id} key={stage.id}>
            <div className="stage-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="stage-content">
              <div className="section-heading">
                <h3>{stage.title}</h3>
                <Tag
                  warning={
                    stale ||
                    stage.status === "unknown" ||
                    stage.status === "rejected"
                  }
                >
                  {stale
                    ? stage.dependencyStale
                      ? "Stale dependency · new project required"
                      : "Stale context"
                    : stage.status === "draft" && !eligible
                      ? "Waiting for approval"
                      : stage.status}
                </Tag>
              </div>
              <small>
                Revision {stage.revision} · {stage.briefs.length} independent
                tasks ·{" "}
                {stage.snapshotId
                  ? "Snapshot locked"
                  : "Context captured on start"}
              </small>
              {stage.briefs.map((brief, i) => {
                const task = tasks.filter((task) => task.stageId === stage.id)[
                  i
                ];
                return (
                  <div className="task-row" key={i}>
                    <Icon name="runs" />
                    <div>
                      <strong>{brief.objective}</strong>
                      <small>
                        {task ? task.status : "Not dispatched"} ·{" "}
                        {brief.acceptance}
                      </small>
                    </div>
                    {task && (
                      <Button variant="ghost" onPress={() => inspect(task)}>
                        Inspect
                      </Button>
                    )}
                  </div>
                );
              })}
              <div className="stage-footer">
                {stage.status === "draft" ? (
                  <Button
                    variant={eligible ? "primary" : "secondary"}
                    isDisabled={
                      !eligible ||
                      busy ||
                      !demo ||
                      project.status === "archived" ||
                      tasks.some((task) =>
                        ["unknown", "running"].includes(task.status),
                      )
                    }
                    onPress={() => {
                      setConfirmed(false);
                      void mutate(async () => {
                        setPreview(
                          await api<StartPreview>(
                            `/stages/${stage.id}/preview`,
                          ),
                        );
                      });
                    }}
                  >
                    Preview & start stage
                  </Button>
                ) : (
                  <Button onPress={review}>
                    Review checkpoint <Icon name="arrow" />
                  </Button>
                )}
                <span>
                  {stage.status === "approved"
                    ? "Approval recorded. Successor has not started."
                    : stage.status === "unknown"
                      ? "Unresolved work. No automatic retry."
                      : "Stage-only admission control"}
                </span>
              </div>
            </div>
          </section>
        );
      })}
      {adding && (
        <form
          id="stage-form"
          className="stage-form"
          onSubmit={(event) => {
            event.preventDefault();
            let saved: Stage | undefined;
            void mutate(
              async () => {
                saved = await api<Stage>(`/projects/${project.id}/stages`, {
                  title,
                  briefs,
                });
                setAdding(false);
                setTitle("Draft the field guide");
                setBriefs([
                  {
                    objective: "Draft using only reviewed findings",
                    acceptance: "Cite supporting context and flag assumptions",
                  },
                ]);
              },
              () => {
                if (saved) setCreatedStageId(saved.id);
              },
            );
          }}
        >
          <h3>
            {stages.length
              ? "Add a dependent stage"
              : "Define your first stage"}
          </h3>
          <label>
            Stage title
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={120}
            />
          </label>
          {briefs.map((brief, index) => (
            <fieldset key={index}>
              <legend>Independent task {index + 1}</legend>
              <label>
                Objective
                <input
                  value={brief.objective}
                  onChange={(event) =>
                    change(index, "objective", event.target.value)
                  }
                  required
                  maxLength={2000}
                />
              </label>
              <label>
                Acceptance criteria
                <input
                  value={brief.acceptance}
                  onChange={(event) =>
                    change(index, "acceptance", event.target.value)
                  }
                  required
                  maxLength={2000}
                />
              </label>
              {briefs.length > 1 && (
                <Button
                  variant="ghost"
                  onPress={() =>
                    setBriefs(briefs.filter((_, i) => i !== index))
                  }
                >
                  Remove task
                </Button>
              )}
            </fieldset>
          ))}
          <div className="actions">
            <Button
              variant="ghost"
              isDisabled={busy}
              onPress={() => {
                setAdding(false);
                requestAnimationFrame(() => addRef.current?.focus());
              }}
            >
              Cancel stage
            </Button>
            <Button
              isDisabled={briefs.length >= 4}
              onPress={() =>
                setBriefs([...briefs, { objective: "", acceptance: "" }])
              }
            >
              + Independent task
            </Button>
            <Button type="submit" variant="primary" isDisabled={busy || !demo}>
              Create stage
            </Button>
          </div>
          <small>Creating a stage does not dispatch work.</small>
        </form>
      )}
    </div>
  );
}
