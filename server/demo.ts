import { randomUUID } from "node:crypto";
import type { Conversation, Message, MessagePage } from "../shared/types.js";
import type { Workspace } from "./domain.js";
import { now } from "./domain.js";
import type { Store } from "./store.js";
export const demoConversations: Conversation[] = [
  {
    key: "demo:harbor",
    sessionId: "demo-harbor-1",
    title: "A field guide to the harbor",
    parentKey: null,
    lineage: "reported",
    status: "Synthetic conversation",
  },
  {
    key: "demo:tidal",
    sessionId: "demo-tidal-1",
    title: "Tidal observations",
    parentKey: "demo:harbor",
    lineage: "reported",
    status: "Synthetic child",
  },
  {
    key: "demo:shore",
    sessionId: "demo-shore-1",
    title: "Shoreline access notes",
    parentKey: "demo:tidal",
    lineage: "incomplete",
    status: "Earlier lineage unavailable",
  },
];
export function seedDemo(store: Store) {
  if (store.db.prepare("SELECT value FROM metadata WHERE key=?").get("seeded"))
    return;
  store.transaction(() => {
    const texts = [
      "Let’s make a thoughtful field guide to the harbor. Keep it practical, gentle on wildlife, and useful to a first-time visitor.",
      "Simulated assistant: we can separate observation from recommendation. Research the tides and walking routes independently, then review both before drafting.",
      "Use public observations only. Avoid nesting sites. Treat tide estimates as assumptions until reviewed.",
      "Simulated assistant: the working packet is ready to curate. Select the messages you want to preserve; a saved excerpt records what was said, not whether it is correct.",
    ];
    texts.forEach((body, index) =>
      addDemoMessage(
        store,
        "demo:harbor",
        body,
        index % 2 === 0 ? "user" : "assistant",
        `m${index + 1}`,
      ),
    );
    addDemoMessage(
      store,
      "demo:tidal",
      "Synthetic observation: the east path may be less accessible at high tide. No real survey was performed.",
      "assistant",
    );
    addDemoMessage(
      store,
      "demo:shore",
      "Synthetic child output. Historical lineage is incomplete; no additional parent relationships are inferred.",
      "assistant",
    );
    store.db
      .prepare("INSERT INTO metadata(key,value) VALUES (?,?)")
      .run("seeded", "1");
  });
}
export function addDemoMessage(
  store: Store,
  key: string,
  body: string,
  role = "user",
  id: string = randomUUID(),
) {
  const conversation = demoConversations.find((item) => item.key === key);
  if (!conversation) throw new Error("Select a known demo conversation");
  const message: Message = {
    id,
    text: body,
    role,
    author: role === "user" ? "You (demo)" : "Simulated assistant",
    source: {
      gateway: "demo",
      operator: "synthetic",
      sessionKey: key,
      sessionId: conversation.sessionId,
      messageId: id,
    },
    simulated: true,
    createdAt: now(),
  };
  store.put("messages", message, { session_key: key });
  return message;
}
export function demoHistory(
  store: Store,
  key: string,
  offset: number,
  limit = 50,
): MessagePage {
  const rows = store.db
    .prepare(
      "SELECT data FROM messages WHERE session_key=? ORDER BY rowid LIMIT ? OFFSET ?",
    )
    .all(key, limit + 1, offset);
  return {
    messages: rows
      .slice(0, limit)
      .map((row) => JSON.parse(row.data as string) as Message),
    nextOffset: rows.length > limit ? offset + limit : null,
    incomplete: key !== "demo:harbor",
  };
}
export class DemoDispatcher {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(private workspace: Workspace) {}
  start(id: string) {
    const tasks = this.workspace.startStage(id);
    tasks.forEach((task, index) => {
      const timer = setTimeout(
        () => {
          this.timers.delete(timer);
          this.workspace.recordResult(
            task.id,
            "completed",
            `SIMULATED OUTPUT — no model or Gateway was called.\n\nObjective: ${task.objective}\nAcceptance criteria to review: ${task.acceptance}\n\nSynthetic evidence: inspect the saved context and compare the proposed approach against the brief. This deterministic sample does not verify correctness.\nSource: demo task ${task.id}`,
          );
        },
        650 + index * 400,
      );
      this.timers.add(timer);
    });
    return tasks;
  }
  close() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}
