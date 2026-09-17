import type { LobsterSounds } from "../lib/useLobsterSounds.js";
import { useState } from "react";
import type {
  Conversation,
  Message,
  MessagePage,
  Project,
} from "../../shared/types.js";
import { Button, Empty, Icon, Tag } from "./Primitives.js";
import { api, formatTime } from "../lib/api.js";
interface Props {
  conversation?: Conversation;
  page: MessagePage;
  offset: number;
  loading: boolean;
  demo: boolean;
  projects: Project[];
  onPage: (offset: number) => void;
  onCreated: (project: Project) => void;
  mutate: (
    fn: () => Promise<unknown>,
    onConfirmed?: () => void,
  ) => Promise<void>;
  soundAction: LobsterSounds["action"];
  inspect: (message: Message) => void;
  onSelection?: (count: number) => void;
  onBrowseCatalog?: () => void;
}
export function Chat({
  conversation,
  page,
  offset,
  loading,
  demo,
  projects,
  onPage,
  onCreated,
  soundAction,
  mutate,
  inspect,
  onSelection,
  onBrowseCatalog,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    key: string;
    pageToken: string;
    messages: Message[];
  } | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>();
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("Harbor field guide");
  const [lifetime, setLifetime] = useState<"short_term" | "long_term">(
    "short_term",
  );
  const [target, setTarget] = useState("");
  function selectMessages(next: string[]) {
    setSelected(next);
    setSelectedPage(page.pageToken);
    onSelection?.(next.length);
  }
  if (!conversation)
    return (
      <Empty title="Choose a conversation.">
        <p>
          Open a conversation from the sidebar. Only the one you select is
          fetched.
        </p>
        {onBrowseCatalog && (
          <Button variant="ghost" onPress={onBrowseCatalog}>
            Browse wiki &amp; skills instead
          </Button>
        )}
      </Empty>
    );
  const currentSelection = selectedPage === page.pageToken ? selected : [];
  const excerpts =
    preview?.messages ??
    page.messages.filter((message) => currentSelection.includes(message.id));
  return (
    <div className="chat-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Conversation</span>
          <h2>{conversation.title}</h2>
        </div>
        <Tag>{demo ? "Synthetic" : "Read-only"}</Tag>
      </div>
      {page.incomplete && (
        <p className="notice">
          ! Incomplete source history. Unreported lineage is not inferred.
        </p>
      )}
      {preview ? (
        <section className="excerpt-preview" aria-label="Excerpt preview">
          <div className="section-heading">
            <h3>Exactly what you’re saving</h3>
            <Button variant="ghost" onPress={() => setPreview(null)}>
              Back to chat
            </Button>
          </div>
          <p>
            These excerpts become local project context. They record what was
            said, not whether it’s true.
          </p>
          {excerpts.map((message) => (
            <blockquote key={message.id}>
              <small>
                {message.author} · {message.id}
              </small>
              <p>{message.text}</p>
            </blockquote>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const sound = soundAction();
              let savedId = "";
              void mutate(
                async () => {
                  const body = {
                    key: preview.key,
                    pageToken: preview.pageToken,
                    messageIds: preview.messages.map((message) => message.id),
                  };
                  if (target) {
                    await api(`/projects/${target}/context`, body);
                    savedId = `${target}:${crypto.randomUUID()}`;
                    setPreview(null);
                    selectMessages([]);
                  } else {
                    const project = await api<Project>("/projects", {
                      ...body,
                      name,
                      lifetime,
                    });
                    savedId = project.id;
                    onCreated(project);
                  }
                },
                () => {
                  if (savedId) sound.saved(savedId);
                },
              );
            }}
          >
            <label>
              Destination
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">Create a new project</option>
                {projects
                  .filter((project) => project.status === "active")
                  .map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </label>
            {!target && (
              <div className="form-row">
                <label>
                  Project name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Lifetime
                  <select
                    value={lifetime}
                    onChange={(event) =>
                      setLifetime(event.target.value as typeof lifetime)
                    }
                  >
                    <option value="short_term">
                      Short-term · a bounded effort
                    </option>
                    <option value="long_term">
                      Long-term · ongoing context
                    </option>
                  </select>
                </label>
              </div>
            )}
            <Button
              type="submit"
              variant="primary"
              isDisabled={loading || excerpts.length === 0}
            >
              {target ? "Add exact excerpts" : "Create project"}
            </Button>
          </form>
        </section>
      ) : (
        <>
          <div
            className="transcript"
            aria-label="Chat transcript"
            aria-busy={loading}
          >
            {page.messages.map((message) => (
              <article
                className={`message ${currentSelection.includes(message.id) ? "selected" : ""}`}
                key={message.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Select message ${message.id}`}
                  checked={currentSelection.includes(message.id)}
                  onChange={(event) =>
                    selectMessages(
                      event.target.checked
                        ? [...currentSelection, message.id]
                        : currentSelection.filter((id) => id !== message.id),
                    )
                  }
                />
                <div
                  className={`avatar ${message.role === "user" ? "human" : ""}`}
                >
                  {message.role === "user" ? "Y" : "c"}
                </div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>{message.author}</strong>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                  <p>{message.text}</p>
                  <Button variant="ghost" onPress={() => inspect(message)}>
                    View provenance
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <div className="transcript-tools">
            <span>
              {currentSelection.length
                ? `${currentSelection.length} selected`
                : "Select messages to curate context"}
            </span>
            <Button
              variant={currentSelection.length ? "primary" : "secondary"}
              isDisabled={
                !currentSelection.length || loading || !page.pageToken
              }
              onPress={() => {
                if (page.pageToken)
                  setPreview({
                    key: conversation.key,
                    pageToken: page.pageToken,
                    messages: structuredClone(excerpts),
                  });
              }}
            >
              Preview excerpts <Icon name="arrow" />
            </Button>
          </div>
          {(offset > 0 || page.nextOffset !== null) && (
            <div className="pagination">
              <Button
                isDisabled={offset === 0}
                onPress={() => {
                  selectMessages([]);
                  onPage(Math.max(0, offset - 50));
                }}
              >
                Previous 50
              </Button>
              <small>Bounded page · {page.messages.length} messages</small>
              <Button
                isDisabled={page.nextOffset === null}
                onPress={() => {
                  selectMessages([]);
                  onPage(page.nextOffset ?? 0);
                }}
              >
                Next 50
              </Button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(async () => {
                await api("/chat", { key: conversation.key, text: draft });
                setDraft("");
                onPage(offset);
              });
            }}
          >
            <label htmlFor="composer">
              {demo
                ? "Try the conversation"
                : "Live conversation · inspection only"}
            </label>
            <textarea
              id="composer"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                demo
                  ? "Write a note. Your lobster has time."
                  : "Channel replies are disabled."
              }
              rows={2}
              maxLength={8000}
              disabled={!demo}
              required
            />
            <div>
              <small>
                {demo
                  ? "Deterministic simulation. No model calls."
                  : "No messages will be sent to this channel."}
              </small>
              <Button
                type="submit"
                variant="primary"
                isDisabled={!demo || !draft.trim() || loading}
              >
                Send demo message <Icon name="arrow" />
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
