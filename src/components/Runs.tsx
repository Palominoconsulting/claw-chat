/* Stage task position is the immutable identity within a fixed stage; form values are fully controlled. */
/* eslint-disable react/no-array-index-key */
import { useState } from "react";
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
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
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
}: Props) {
  const [adding, setAdding] = useState(stages.length === 0);
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
  function change(index: number, field: keyof TaskBrief, value: string) {
    setBriefs(
      briefs.map((brief, i) =>
        i === index ? { ...brief, [field]: value } : brief,
      ),
    );
  }
  return (
    <div className="content-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Bounded work, deliberate starts</span>
          <h2>One stage at a time.</h2>
        </div>
        <Button
          isDisabled={project.status === "archived" || !demo}
          onPress={() => setAdding(!adding)}
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
            <h3>Review the launch packet</h3>
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
            onPress={() =>
              void mutate(async () => {
                await api(`/stages/${preview.stage.id}/start`, {
                  token: preview.token,
                });
                setPreview(null);
              })
            }
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
          <section className="stage" key={stage.id}>
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
          className="stage-form"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(async () => {
              await api(`/projects/${project.id}/stages`, { title, briefs });
              setAdding(false);
              setTitle("Draft the field guide");
              setBriefs([
                {
                  objective: "Draft using only reviewed findings",
                  acceptance: "Cite supporting context and flag assumptions",
                },
              ]);
            });
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
