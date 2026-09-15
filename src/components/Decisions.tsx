import { useState } from "react";
import type { Project, ReviewEvent, Stage, Task } from "../../shared/types.js";
import { api, formatTime } from "../lib/api.js";
import { Button, Empty, Tag } from "./Primitives.js";
function Decision({
  project,
  stage,
  tasks,
  next,
  busy,
  mutate,
}: {
  project: Project;
  stage: Stage;
  tasks: Task[];
  next?: Stage;
  busy: boolean;
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [proposal, setProposal] = useState(stage.proposal);
  const [assumptions, setAssumptions] = useState(stage.assumptions);
  const [missing, setMissing] = useState(stage.missing);
  const [alternatives, setAlternatives] = useState(stage.alternatives);
  const [requestId] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState("");
  const [read, setRead] = useState<string[]>([]);
  const dirty =
    proposal !== stage.proposal ||
    assumptions !== stage.assumptions ||
    missing !== stage.missing ||
    alternatives !== stage.alternatives;
  const ready =
    !stage.dependencyStale &&
    tasks.length === stage.briefs.length &&
    tasks.every((task) => task.status === "completed") &&
    stage.contextVersion === project.contextVersion &&
    read.length === tasks.length &&
    note.trim() &&
    !dirty &&
    project.status === "active";
  return (
    <section className="decision">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            Operator checkpoint · revision {stage.revision}
          </span>
          <h3>{stage.title}</h3>
        </div>
        <Tag
          warning={
            stage.dependencyStale ||
            stage.status === "unknown" ||
            stage.contextVersion !== project.contextVersion
          }
        >
          {stage.dependencyStale
            ? "Stale dependency · new project required"
            : stage.contextVersion !== project.contextVersion
              ? "Stale context"
              : stage.status}
        </Tag>
      </div>
      <p className="notice">
        Affects: {next?.title ?? "Project completion (no dependent stage yet)"}.
        Approval never starts work.
      </p>
      <h4>Account for the evidence</h4>
      {tasks.map((task) => (
        <div className="evidence" key={task.id}>
          <details>
            <summary>
              {task.objective} · {task.status}
            </summary>
            <pre>{task.output || "No result received."}</pre>
            <small>
              Task {task.id} · Snapshot {task.snapshotId}
            </small>
          </details>
          <label className="check-label">
            <input
              type="checkbox"
              checked={read.includes(task.id)}
              onChange={(event) =>
                setRead(
                  event.target.checked
                    ? [...read, task.id]
                    : read.filter((id) => id !== task.id),
                )
              }
            />
            I examined this output against its acceptance criteria.
          </label>
        </div>
      ))}
      <label>
        Proposed decision
        <textarea
          value={proposal}
          onChange={(event) => setProposal(event.target.value)}
          rows={3}
          maxLength={20000}
        />
      </label>
      <div className="form-row">
        <label>
          Assumptions
          <textarea
            value={assumptions}
            onChange={(event) => setAssumptions(event.target.value)}
            rows={2}
            maxLength={20000}
          />
        </label>
        <label>
          Missing evidence
          <textarea
            value={missing}
            onChange={(event) => setMissing(event.target.value)}
            rows={2}
            maxLength={20000}
          />
        </label>
      </div>
      <label>
        Rejected alternatives
        <textarea
          value={alternatives}
          onChange={(event) => setAlternatives(event.target.value)}
          rows={2}
          maxLength={20000}
        />
      </label>
      {dirty && (
        <div className="notice">
          <p>
            Proposal changed. Save a new revision before reviewing. The previous
            approval cannot authorize it.
          </p>
          <Button
            isDisabled={busy || !proposal.trim() || stage.status === "unknown"}
            onPress={() =>
              void mutate(() =>
                api(`/stages/${stage.id}/revise`, {
                  revision: stage.revision,
                  generation: stage.reviewGeneration,
                  proposal,
                  assumptions,
                  missing,
                  alternatives,
                }),
              )
            }
          >
            Save new revision
          </Button>
        </div>
      )}
      <label>
        Review note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you examine, and why is this ready (or not)?"
          rows={2}
          maxLength={4000}
        />
      </label>
      {stage.status === "unknown" && (
        <section className="notice">
          <p>
            Interrupted demo work is unresolved. Confirm its timers stopped to
            abandon it without claiming success or retrying. This stage remains
            rejected; create a fresh project for new execution.
          </p>
          <Button
            isDisabled={busy || !note.trim()}
            onPress={() =>
              void mutate(() =>
                api(`/stages/${stage.id}/reconcile`, { note, abandon: true }),
              )
            }
          >
            Confirm stopped demo · abandon results
          </Button>
        </section>
      )}
      <div className="actions">
        <Button
          variant="primary"
          isDisabled={!ready || busy}
          onPress={() =>
            void mutate(() =>
              api(`/stages/${stage.id}/review`, {
                revision: stage.revision,
                generation: stage.reviewGeneration,
                requestId,
                action: "approve",
                note,
              }),
            )
          }
        >
          Approve revision {stage.revision}
        </Button>
        <Button
          isDisabled={!ready || busy}
          onPress={() =>
            void mutate(() =>
              api(`/stages/${stage.id}/review`, {
                revision: stage.revision,
                generation: stage.reviewGeneration,
                requestId,
                action: "changes",
                note,
              }),
            )
          }
        >
          Request changes
        </Button>
        <Button
          variant="danger"
          isDisabled={!ready || busy}
          onPress={() =>
            void mutate(() =>
              api(`/stages/${stage.id}/review`, {
                revision: stage.revision,
                generation: stage.reviewGeneration,
                requestId,
                action: "reject",
                note,
              }),
            )
          }
        >
          Reject
        </Button>
      </div>
      <small>
        Human review of this stage only. Not a Gateway exec or plugin approval.
      </small>
    </section>
  );
}
export function Decisions({
  project,
  stages,
  tasks,
  events,
  busy,
  mutate,
}: {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  events: ReviewEvent[];
  busy: boolean;
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const reviewable = stages.filter((stage) =>
    ["review", "approved", "changes", "rejected", "unknown"].includes(
      stage.status,
    ),
  );
  return (
    <div className="content-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow">You make the call</span>
          <h2>Look closely. Then decide.</h2>
        </div>
        <Tag>
          {reviewable.filter((stage) => stage.status !== "approved").length} to
          review
        </Tag>
      </div>
      {reviewable.length === 0 && (
        <Empty title="Nothing needs your approval yet.">
          <p>
            Start a stage from Runs. Its checkpoint appears once results are
            accounted for.
          </p>
        </Empty>
      )}
      {reviewable.map((stage) => (
        <Decision
          key={`${stage.id}:${stage.revision}:${stage.reviewGeneration}:${stage.status}`}
          project={project}
          stage={stage}
          tasks={tasks.filter((task) => task.stageId === stage.id)}
          next={stages.find((other) => other.position === stage.position + 1)}
          busy={busy}
          mutate={mutate}
        />
      ))}
      {events.length > 0 && (
        <section className="audit">
          <h3>Review record</h3>
          {events.map((event) => (
            <div key={event.id}>
              <Tag>{event.action.replaceAll("_", " ")}</Tag>
              <span>
                r{event.revision} · {event.note}
              </span>
              <small>{formatTime(event.createdAt)}</small>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
