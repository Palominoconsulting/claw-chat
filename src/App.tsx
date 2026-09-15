import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Conversation,
  Message,
  MessagePage,
  Project,
  Snapshot,
  Task,
  WorkspaceState,
} from "../shared/types.js";
import { api, bootstrap, formatTime } from "./lib/api.js";
import { Button, Empty, Icon, Tag } from "./components/Primitives.js";
import { Sidebar } from "./components/Sidebar.js";
import { Chat } from "./components/Chat.js";
import { ContextView } from "./components/Context.js";
import { Runs } from "./components/Runs.js";
import { Decisions } from "./components/Decisions.js";
import { Mascot } from "./components/Mascot.js";
import { GuidedDemo } from "./components/GuidedDemo.js";
import { GUIDE_PREFERENCE, guidedProgress } from "./lib/guidedDemo.js";
import type { GuideRun } from "./lib/guidedDemo.js";
type Tab = "Chat" | "Runs" | "Decisions" | "Context";
type Inspection =
  | { type: "message"; value: Message }
  | { type: "task"; value: Task; snapshot?: Snapshot }
  | null;
const emptyPage: MessagePage = {
  messages: [],
  nextOffset: null,
  incomplete: false,
};
export default function App() {
  const [guide, setGuide] = useState<GuideRun | null>(null);
  const [guideSelection, setGuideSelection] = useState<string[]>([]);
  const workspaceBodyRef = useRef<HTMLDivElement>(null);
  const [practiceAttempt, setPracticeAttempt] = useState(0);
  const [guidePreference, setGuidePreference] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_PREFERENCE) ?? "";
    } catch {
      return "";
    }
  });
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projectId, setProjectId] = useState("");
  const [conversationKey, setConversationKey] = useState("");
  const [tab, setTab] = useState<Tab>("Chat");
  const [page, setPage] = useState<MessagePage>(emptyPage);
  const [offset, setOffset] = useState(0);
  const [screen, setScreen] = useState<"welcome" | "workspace" | "setup">(
    "welcome",
  );
  const [inspection, setInspection] = useState<Inspection>(null);
  const [inspectorOpen, setInspectorOpen] = useState(
    () => window.matchMedia("(min-width: 951px)").matches,
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stamp, setStamp] = useState("");
  const busyRef = useRef(false);
  const historyRequestRef = useRef(0);
  useEffect(() => {
    // Chat owns selection. Resync after saves/page changes that clear its controls,
    // retaining selection while the exact-excerpt preview replaces the transcript.
    const transcript = workspaceBodyRef.current?.querySelector(".transcript");
    if (
      !transcript ||
      state?.connection.mode !== "demo" ||
      tab !== "Chat" ||
      conversationKey !== "demo:harbor"
    )
      return;
    const checked = Array.from(
      transcript.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )
      .filter((input) => input.checked)
      .map((input) => input.getAttribute("aria-label"));
    const selected = page.messages
      .filter(
        (message) =>
          message.simulated && checked.includes(`Select message ${message.id}`),
      )
      .map((message) => message.id);
    const frame = requestAnimationFrame(() => {
      setGuideSelection((current) =>
        current.join("\n") === selected.join("\n") ? current : selected,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [state, page, tab, conversationKey, practiceAttempt]);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("claw-chat.theme") === "dark";
    } catch {
      return false;
    }
  });
  const refresh = useCallback(async () => {
    const next = await api<WorkspaceState>("/state");
    setState(next);
    if (next.connection.mode === "demo") setConversations(next.conversations);
    setStamp(new Date().toISOString());
  }, []);
  useEffect(() => {
    void bootstrap()
      .then(refresh)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Cannot connect to local service",
        ),
      );
  }, [refresh]);
  const running =
    state?.tasks.some((task) => task.status === "running") ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        void refresh().catch(() =>
          setError("Refresh failed. Last known state retained."),
        );
    }, 700);
    return () => clearInterval(timer);
  }, [refresh, running]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("claw-chat.theme", dark ? "dark" : "light");
    } catch {
      /* Optional preference. */
    }
  }, [dark]);
  async function mutate(fn: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Operation failed. Last known state retained.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function loadPage(key: string, start: number) {
    const requestId = ++historyRequestRef.current;
    const next = await api<MessagePage>(
      `/history?key=${encodeURIComponent(key)}&offset=${start}&limit=50`,
    );
    if (requestId === historyRequestRef.current) {
      setPage(next);
      setOffset(start);
    }
  }
  function selectConversation(key: string) {
    setGuideSelection([]);
    void mutate(async () => {
      await api("/select", { key });
      setConversationKey(key);
      setPage(emptyPage);
      setInspection(null);
      setScreen("workspace");
      setTab("Chat");
      setMobileNav(false);
      await loadPage(key, 0);
    });
  }
  function chooseProject(id: string) {
    setGuideSelection([]);
    setProjectId(id);
    setScreen("workspace");
    setTab("Context");
    setMobileNav(false);
    setInspection(null);
  }
  function created(project: Project) {
    if (conversationKey === "demo:harbor" && guideSelection.length) {
      // A delayed create response must not resurrect a skipped guide.
      setGuide((current) =>
        current &&
        !current.projectId &&
        !current.baselineProjectIds.includes(project.id)
          ? {
              ...current,
              projectId: project.id,
              sourceMessageIds: guideSelection,
            }
          : current,
      );
    }
    setGuideSelection([]);
    setProjectId(project.id);
    setTab("Context");
    setScreen("workspace");
    setInspection(null);
  }
  const project = state?.projects.find((project) => project.id === projectId);
  const stages =
    state?.stages.filter((stage) => stage.projectId === projectId) ?? [];
  const tasks =
    state?.tasks.filter((task) =>
      stages.some((stage) => stage.id === task.stageId),
    ) ?? [];
  const context =
    state?.context.filter((item) => item.projectId === projectId) ?? [];
  const events =
    state?.events.filter((event) =>
      stages.some((stage) => stage.id === event.stageId),
    ) ?? [];
  const conversation = conversations.find(
    (conversation) => conversation.key === conversationKey,
  );
  const demo = state?.connection.mode === "demo";
  const progress =
    state && guide ? guidedProgress(state, guide, guideSelection) : null;
  useEffect(() => {
    if (progress?.step !== "complete") return;
    try {
      localStorage.setItem(GUIDE_PREFERENCE, "completed");
    } catch {
      /* Optional UI preference only. */
    }
  }, [progress?.step]);
  function dismissGuide() {
    const preference =
      progress?.step === "complete" ? "completed" : "dismissed";
    try {
      localStorage.setItem(GUIDE_PREFERENCE, preference);
    } catch {
      /* Practice still works when storage is unavailable. */
    }
    setGuidePreference(preference);
    setGuide(null);
    setGuideSelection([]);
  }
  function startGuide() {
    if (!demo || !state || busyRef.current) return;
    setGuide({
      baselineProjectIds: state.projects.map((item) => item.id),
      projectId: null,
      sourceMessageIds: [],
      inspectedTaskIds: [],
    });
    setPracticeAttempt((attempt) => attempt + 1);
    setProjectId("");
    selectConversation("demo:harbor");
  }
  function navigateTab(next: Tab) {
    if (next !== tab) setGuideSelection([]);
    setTab(next);
  }
  const task =
    inspection?.type === "task"
      ? (state?.tasks.find((task) => task.id === inspection.value.id) ??
        inspection.value)
      : null;
  function inspectTask(value: Task) {
    setInspectorOpen(true);
    setInspection({ type: "task", value });
    void mutate(async () => {
      const snapshot = await api<Snapshot>(`/stages/${value.stageId}/snapshot`);
      setInspection({ type: "task", value, snapshot });
      if (value.status === "completed" && value.output) {
        setGuide((current) =>
          current && snapshot.projectId === current.projectId
            ? {
                ...current,
                inspectedTaskIds: [
                  ...new Set([...current.inspectedTaskIds, value.id]),
                ],
              }
            : current,
        );
      }
    });
  }
  return (
    <div
      className={`app ${inspectorOpen && screen === "workspace" ? "" : "inspector-collapsed"}`}
    >
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <Sidebar
        projects={state?.projects ?? []}
        conversations={conversations}
        projectId={projectId}
        conversationKey={conversationKey}
        onProject={chooseProject}
        onConversation={selectConversation}
        onHome={() => setScreen("welcome")}
        onSetup={() => setScreen("setup")}
        mobileOpen={mobileNav}
      />
      <main id="main" className="main">
        <header className="topbar">
          <div>
            <Button
              className="mobile-menu"
              variant="ghost"
              onPress={() => setMobileNav(!mobileNav)}
              aria-expanded={mobileNav}
            >
              Menu
            </Button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {screen === "setup"
                  ? "Connection"
                  : (project?.name ?? "A fresh start")}
              </strong>
            </span>
          </div>
          <div className="top-actions">
            {demo && screen === "workspace" && !guide && (
              <Button variant="ghost" isDisabled={busy} onPress={startGuide}>
                Learn by doing
              </Button>
            )}
            <Tag warning={state?.connection.state === "unsupported"}>
              {demo ? "DEMO · SIMULATED" : "LIVE · NOT VERIFIED"}
            </Tag>
            <Button
              variant="ghost"
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onPress={() => setDark(!dark)}
            >
              <Icon name={dark ? "sun" : "moon"} />
            </Button>
            <Button
              variant="ghost"
              aria-label="Toggle inspector"
              aria-expanded={inspectorOpen}
              onPress={() => setInspectorOpen(!inspectorOpen)}
            >
              <Icon name="panel" />
            </Button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <strong>! Action not completed</strong>
            <span>{error}</span>
            <Button
              variant="ghost"
              onPress={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </Button>
          </div>
        )}
        {!state ? (
          <div className="empty">
            <h2>
              {error
                ? "Your local service needs attention."
                : "Opening your workspace…"}
            </h2>
            <p>No Gateway connection is made automatically.</p>
          </div>
        ) : screen === "welcome" ? (
          <div className="welcome">
            <section className="welcome-copy">
              <span className="eyebrow">A local home for big ideas</span>
              <h1>
                Good work.
                <br />
                Great claws.
              </h1>
              <p>
                Bring your conversations into focus. Keep the context that
                matters. Give every next step a deliberate yes.
              </p>
              <div className="guided-welcome-actions">
                {demo && (
                  <Button
                    variant="primary"
                    isDisabled={busy}
                    onPress={startGuide}
                  >
                    {guidePreference
                      ? "Try a guided example again"
                      : "Try a guided example"}
                    <Icon name="arrow" />
                  </Button>
                )}
                <Button
                  variant={demo ? "secondary" : "primary"}
                  isDisabled={busy}
                  aria-label={
                    demo ? "Explore the demo · Explore on my own" : undefined
                  }
                  onPress={() => {
                    if (demo) {
                      dismissGuide();
                      selectConversation("demo:harbor");
                    } else setScreen("setup");
                  }}
                >
                  {demo ? "Explore on my own" : "Set up a connection"}
                  <Icon name="arrow" />
                </Button>
              </div>
              <small>
                {demo
                  ? "Synthetic conversations. Real, local workflow."
                  : "Explicit pairing. Read-only first. No automatic access."}
              </small>
              <div className="welcome-footnote">
                <span>01 / COLLECT</span>
                <span>02 / REVIEW</span>
                <span>03 / CONTINUE</span>
              </div>
            </section>
            <figure className="hero-photo">
              <img
                src="/assets/lobster-hero.webp"
                alt="Dramatic scarlet lobster against a warm dark background"
              />
              <figcaption>
                Your decidedly overqualified emotional support crustacean.
              </figcaption>
              <span className="photo-note">
                SERIOUS WORK.
                <br />A LITTLE SHELLFISH.
              </span>
            </figure>
            <section className="welcome-bottom">
              <strong>A calmer kind of control.</strong>
              <p>
                Not every thought needs a project. Not every result deserves
                approval.
                <br />
                This is the space to tell them apart.
              </p>
              <span>
                Private by design.
                <br />
                Stored on your device.
              </span>
            </section>
          </div>
        ) : screen === "setup" ? (
          <div className="setup content-view">
            <span className="eyebrow">Know what’s connected</span>
            <h1>A clear boundary.</h1>
            <Tag>{state.connection.state.replaceAll("_", " ")}</Tag>
            <p className="lede">{state.connection.detail}</p>
            <div className="setup-split">
              <div>
                <h3>Synthetic demo</h3>
                <p>
                  Real SQLite persistence, context curation and stage gates.
                  Replies and task outputs are deterministic simulations. No
                  Gateway can be contacted in demo mode.
                </p>
                <h3>Live, read-only candidate</h3>
                <p>
                  Requires an explicitly supplied server-side bootstrap secret
                  and normal device pairing. Uses the pinned public 2026.8.1
                  client/protocol. No real Gateway compatibility has been
                  certified.
                </p>
                <p>
                  Restart with APP_MODE=live and separate storage to try
                  pairing. Credentials are never entered in this browser. See
                  README for the exact environment contract.
                </p>
                <Button
                  isDisabled={demo || busy}
                  variant="primary"
                  onPress={() =>
                    void mutate(async () => {
                      await api("/connect", {});
                      setConversations(
                        await api<Conversation[]>("/conversations"),
                      );
                    })
                  }
                >
                  Request read-only pairing
                </Button>
                <Button
                  isDisabled={
                    demo || state.connection.state !== "read_only_unverified"
                  }
                  onPress={() =>
                    void mutate(async () =>
                      setConversations(
                        await api<Conversation[]>("/conversations"),
                      ),
                    )
                  }
                >
                  Refresh session index
                </Button>
                <h3>Managed execution</h3>
                <p>
                  Demo only. A separate write-scope upgrade and verified result
                  reconciliation are required before live tasks can be enabled.
                  This build never requests write, admin or runtime approval
                  scope.
                </p>
              </div>
              <img
                src="/assets/lobster-claw.webp"
                alt="A glossy scarlet lobster claw"
              />
            </div>
          </div>
        ) : (
          <>
            <nav className="tabs" aria-label="Project views">
              {(["Chat", "Runs", "Decisions", "Context"] as Tab[]).map(
                (name) => (
                  <Button
                    variant="ghost"
                    key={name}
                    aria-current={tab === name ? "page" : undefined}
                    onPress={() => navigateTab(name)}
                  >
                    <Icon
                      name={
                        name === "Chat"
                          ? "chat"
                          : name === "Runs"
                            ? "runs"
                            : name === "Decisions"
                              ? "decision"
                              : "context"
                      }
                    />
                    {name}
                    {name === "Decisions" &&
                      stages.some((stage) => stage.status === "review") && (
                        <span className="review-dot" />
                      )}
                  </Button>
                ),
              )}
              <span>
                {project
                  ? `${project.lifetime === "long_term" ? "Long-term" : "Short-term"} · v${project.version}`
                  : "No project selected"}
              </span>
            </nav>
            {demo && guide && progress && (
              <GuidedDemo
                progress={progress}
                tab={tab}
                busy={busy}
                elsewhere={
                  guide.projectId
                    ? projectId !== guide.projectId
                    : conversationKey !== "demo:harbor"
                }
                onNavigate={navigateTab}
                onReturn={() => {
                  if (guide.projectId) chooseProject(guide.projectId);
                  else selectConversation("demo:harbor");
                }}
                onRestart={startGuide}
                onDismiss={dismissGuide}
              />
            )}
            <div
              className="workspace-body"
              ref={workspaceBodyRef}
              onChangeCapture={(event) => {
                // Observe the real Chat checkboxes; no second selection UI or authority.
                const input = event.target;
                if (
                  !guide ||
                  tab !== "Chat" ||
                  conversationKey !== "demo:harbor" ||
                  !(input instanceof HTMLInputElement) ||
                  input.type !== "checkbox" ||
                  !input.closest(".message")
                )
                  return;
                const message = page.messages.find(
                  (item) =>
                    input.getAttribute("aria-label") ===
                    `Select message ${item.id}`,
                );
                if (!message?.simulated) return;
                requestAnimationFrame(() => {
                  if (!input.isConnected) return;
                  setGuideSelection((selected) =>
                    input.checked
                      ? [...new Set([...selected, message.id])]
                      : selected.filter((id) => id !== message.id),
                  );
                });
              }}
            >
              {tab === "Chat" ? (
                <Chat
                  key={`${conversationKey}:${practiceAttempt}`}
                  conversation={conversation}
                  page={page}
                  offset={offset}
                  loading={busy}
                  demo={demo}
                  projects={state.projects}
                  onPage={(start) => {
                    setGuideSelection([]);
                    void loadPage(conversationKey, start).catch((cause) =>
                      setError(String(cause)),
                    );
                  }}
                  onCreated={created}
                  mutate={mutate}
                  inspect={(value) => {
                    setInspection({ type: "message", value });
                    setInspectorOpen(true);
                  }}
                />
              ) : !project ? (
                <Empty title="First, give your context a home.">
                  <p>
                    Select messages in Chat, preview the exact excerpts, and
                    create a project.
                  </p>
                  <Button onPress={() => setTab("Chat")}>Back to chat</Button>
                </Empty>
              ) : tab === "Context" ? (
                <ContextView
                  project={project}
                  items={context}
                  mutate={mutate}
                />
              ) : tab === "Runs" ? (
                <Runs
                  key={project.id}
                  project={project}
                  stages={stages}
                  tasks={tasks}
                  context={context}
                  demo={demo}
                  busy={busy}
                  mutate={mutate}
                  inspect={inspectTask}
                  review={() => setTab("Decisions")}
                />
              ) : (
                <Decisions
                  project={project}
                  stages={stages}
                  tasks={tasks}
                  events={events}
                  busy={busy}
                  mutate={mutate}
                />
              )}
            </div>
          </>
        )}
        <footer className="statusbar">
          <span>
            {busy
              ? "Saving…"
              : `Local state · ${stamp ? formatTime(stamp) : "loading"}`}
          </span>
          <Mascot
            blocked={
              Boolean(error) ||
              Boolean(guide) ||
              tab === "Decisions" ||
              tab === "Runs" ||
              tasks.some((task) => ["failed", "unknown"].includes(task.status))
            }
          />
        </footer>
      </main>
      {inspectorOpen && screen === "workspace" && (
        <aside className="inspector">
          <div className="inspector-header">
            <span>Inspector</span>
            <Button
              variant="ghost"
              aria-label="Close inspector"
              onPress={() => setInspectorOpen(false)}
            >
              ×
            </Button>
          </div>
          {inspection?.type === "message" ? (
            <>
              <span className="eyebrow">Source excerpt</span>
              <h3>{inspection.value.author}</h3>
              <p>{inspection.value.text}</p>
              <dl>
                <dt>Gateway namespace</dt>
                <dd>{inspection.value.source.gateway}</dd>
                <dt>Operator namespace</dt>
                <dd>{inspection.value.source.operator}</dd>
                <dt>Session key</dt>
                <dd>{inspection.value.source.sessionKey}</dd>
                <dt>Session instance</dt>
                <dd>{inspection.value.source.sessionId}</dd>
                <dt>Message ID</dt>
                <dd>{inspection.value.id}</dd>
              </dl>
              <p className="fine-print">
                Speaker labels are not verified human identities.
              </p>
            </>
          ) : inspection?.type === "task" && task ? (
            <>
              <span className="eyebrow">App-managed task · demo</span>
              <h3>{task.objective}</h3>
              <Tag warning={task.status === "unknown"}>{task.status}</Tag>
              <h4>Acceptance criteria</h4>
              <p>{task.acceptance}</p>
              <h4>Output</h4>
              <pre>{task.output || "Waiting for simulated result…"}</pre>
              <dl>
                <dt>Task</dt>
                <dd>{task.id}</dd>
                <dt>Run</dt>
                <dd>{task.runId}</dd>
                <dt>Session instance</dt>
                <dd>{task.sessionId}</dd>
                <dt>Snapshot SHA-256</dt>
                <dd>{inspection.snapshot?.digest ?? "Loading…"}</dd>
              </dl>
              <details>
                <summary>Exact launch snapshot</summary>
                {inspection.snapshot?.items.map((item) => (
                  <blockquote key={item.id}>{item.text}</blockquote>
                ))}
              </details>
              <p className="fine-print">
                No native child lineage claimed. All deterministic demo work is
                accounted for by its task ledger.
              </p>
            </>
          ) : (
            <div className="inspector-empty">
              <span className="eyebrow">A closer look</span>
              <h2>
                Nothing hidden.
                <br />
                Just tucked away.
              </h2>
              <p>
                Select a message or inspect a task to see its source, brief,
                output and exact context snapshot.
              </p>
              <div className="inspector-rule" />
              <small>
                Context is what you contributed.
                <br />
                It is not the model’s complete prompt.
              </small>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
