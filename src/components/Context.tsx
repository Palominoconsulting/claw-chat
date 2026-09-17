import { useState } from "react";
import type {
  ContextItem,
  ContextKind,
  Project,
  ProjectBundle,
} from "../../shared/types.js";
import { api, formatTime } from "../lib/api.js";
import { Button, Tag } from "./Primitives.js";
const kindLabels: Record<ContextKind, string> = {
  source_excerpt: "Source excerpt",
  note: "Note",
  constraint: "Constraint",
  assumption: "Assumption",
  proposed_decision: "Proposed decision",
  approved_decision: "Approved decision",
};
function ContextEditor({
  item,
  mutate,
}: {
  item: ContextItem;
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState(item.kind);
  const [text, setText] = useState(item.text);
  const [editing, setEditing] = useState(false);
  return (
    <article className="context-item">
      <div className="section-heading">
        <div>
          <Tag>{kindLabels[item.kind]}</Tag>
          <small> v{item.version}</small>
        </div>
        <Button variant="ghost" onPress={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit item"}
        </Button>
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(async () => {
              await api(`/projects/${item.projectId}/context/${item.id}`, {
                kind,
                text,
              });
              setEditing(false);
            });
          }}
        >
          <label>
            Context type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ContextKind)}
            >
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Context text
            <textarea
              rows={5}
              value={text}
              readOnly={kind === "source_excerpt"}
              onChange={(event) => setText(event.target.value)}
              required
              maxLength={20000}
            />
          </label>
          <small>
            Source excerpts are immutable. Choose Note to edit your
            interpretation. Material edits make launched work stale.
          </small>
          <Button type="submit" variant="primary">
            Save context change
          </Button>
        </form>
      ) : (
        <p>{item.text}</p>
      )}
      <details>
        <summary>Source & capture</summary>
        <dl>
          <dt>Author label</dt>
          <dd>{item.author}</dd>
          <dt>Captured</dt>
          <dd>{formatTime(item.capturedAt)}</dd>
          <dt>Session instance</dt>
          <dd>{item.source.sessionId}</dd>
          <dt>Message</dt>
          <dd>{item.source.messageId}</dd>
          <dt>Original captured text</dt>
          <dd>
            {item.originalText ??
              "Original unavailable for this older interpretation"}
          </dd>
          <dt>Original SHA-256</dt>
          <dd className="digest">{item.originalHash ?? "Unavailable"}</dd>
          <dt>Excerpt SHA-256</dt>
          <dd className="digest">{item.hash}</dd>
        </dl>
      </details>
    </article>
  );
}
export function ContextView({
  project,
  items,
  mutate,
}: {
  project: Project;
  items: ContextItem[];
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  function download() {
    if (!bundle) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `claw-chat-project-${project.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBundle(null);
  }
  return (
    <div className="content-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow">The context you chose</span>
          <h2>Keep the important parts.</h2>
        </div>
        <Tag>Context v{project.contextVersion}</Tag>
      </div>
      <p className="lede">
        Source-linked, editable, yours. Every stage receives an immutable
        snapshot of this packet. The Gateway may add its own instructions and
        memory.
      </p>
      <div className="project-actions">
        <Button
          onPress={() =>
            void mutate(() =>
              api(`/projects/${project.id}`, {
                lifetime:
                  project.lifetime === "short_term"
                    ? "long_term"
                    : "short_term",
              }),
            )
          }
        >
          {project.lifetime === "short_term"
            ? "Promote to long-term"
            : "Make short-term"}
        </Button>
        <Button
          onPress={() =>
            void mutate(async () =>
              setBundle(
                await api<ProjectBundle>(`/projects/${project.id}/export`),
              ),
            )
          }
        >
          Preview export
        </Button>
        <Button variant="ghost" onPress={() => setArchiveConfirm(true)}>
          {project.status === "active" ? "Archive project" : "Restore project"}
        </Button>
      </div>
      {archiveConfirm && (
        <section className="notice">
          <p>
            {project.status === "active"
              ? "Archive this project? It will block new starts. Nothing is deleted or stopped."
              : "Restore this project to active work?"}
          </p>
          <Button
            onPress={() =>
              void mutate(async () => {
                await api(`/projects/${project.id}`, {
                  status: project.status === "active" ? "archived" : "active",
                });
                setArchiveConfirm(false);
              })
            }
          >
            Confirm {project.status === "active" ? "archive" : "restore"}
          </Button>
          <Button variant="ghost" onPress={() => setArchiveConfirm(false)}>
            Cancel
          </Button>
        </section>
      )}
      {bundle && (
        <section className="export-preview">
          <h3>Export preview</h3>
          <p>
            Only this project’s saved context, snapshots, tasks and review
            events. No unselected chat history or app credentials. Your own
            excerpts may contain sensitive information; inspect before saving.
          </p>
          <pre>{JSON.stringify(bundle, null, 2)}</pre>
          <Button variant="primary" onPress={download}>
            Download project JSON
          </Button>
          <Button variant="ghost" onPress={() => setBundle(null)}>
            Cancel export
          </Button>
        </section>
      )}
      <div className="context-list">
        {items.map((item) => (
          <ContextEditor
            key={`${item.id}:${item.version}`}
            item={item}
            mutate={mutate}
          />
        ))}
      </div>
    </div>
  );
}
