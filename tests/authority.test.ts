import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { Store } from "../server/store.js";
import { Workspace } from "../server/domain.js";
import { DemoDispatcher } from "../server/demo.js";
const stores: Store[] = [];
function fixture() {
  const store = new Store(":memory:", "demo");
  stores.push(store);
  const w = new Workspace(store);
  const p = w.createProject("Synthetic authority", "short_term", [
    {
      text: "PREVIEWED",
      author: "Test",
      source: {
        gateway: "demo",
        operator: "test",
        sessionKey: "test",
        sessionId: "one",
        messageId: "one",
      },
    },
  ]);
  const a = w.createStage(p.id, "A", [
    { objective: "Observe", acceptance: "Evidence" },
  ]);
  const b = w.createStage(p.id, "B", [
    { objective: "Compare", acceptance: "Evidence" },
  ]);
  const c = w.createStage(p.id, "C", [
    { objective: "Draft", acceptance: "Evidence" },
  ]);
  return { w, p, a, b, c };
}
function finish(w: Workspace, id: string) {
  w.startStage(id, w.previewStart(id).token).forEach((t) =>
    w.recordResult(t.id, "completed", "FULL EVIDENCE"),
  );
}
function approve(w: Workspace, id: string) {
  const s = w.stage(id);
  w.review(
    id,
    s.revision,
    "approve",
    "Explicit review",
    s.reviewGeneration,
    randomUUID(),
  );
}
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("stale launch packet fails before dispatcher side effects; exact duplicate schedules once", () => {
  vi.useFakeTimers();
  const { w, p, a } = fixture();
  const d = new DemoDispatcher(w);
  const timer = vi.spyOn(globalThis, "setTimeout");
  const old = w.previewStart(a.id);
  const item = w.context(p.id)[0]!;
  w.editContext(p.id, item.id, "note", "UNSEEN");
  expect(() => d.start(a.id, old.token)).toThrow(/stale/i);
  expect(timer).toHaveBeenCalledTimes(0);
  expect(w.tasks()).toHaveLength(0);
  const fresh = w.previewStart(a.id);
  d.start(a.id, fresh.token);
  d.start(a.id, fresh.token);
  expect(timer).toHaveBeenCalledTimes(1);
  expect(w.tasks()).toHaveLength(1);
  expect(w.snapshot(a.id).items[0]?.text).toBe("UNSEEN");
  d.close();
});
it("review CAS rejects a delayed approval after a newer rejection, and duplicates do not append", () => {
  const { w, a } = fixture();
  finish(w, a.id);
  const g = w.stage(a.id).reviewGeneration;
  const key = randomUUID();
  w.review(a.id, 1, "approve", "First", g, key);
  w.review(a.id, 1, "approve", "First", g, key);
  expect(
    w.exportProject(a.projectId).events.filter((e) => e.action === "approve"),
  ).toHaveLength(1);
  w.review(
    a.id,
    1,
    "reject",
    "Reconsidered",
    w.stage(a.id).reviewGeneration,
    randomUUID(),
  );
  expect(() => w.review(a.id, 1, "approve", "First", g, key)).toThrow(/stale/i);
  expect(() =>
    w.review(a.id, 1, "approve", "Other stale tab", g, randomUUID()),
  ).toThrow(/stale/i);
  expect(w.stage(a.id).status).toBe("rejected");
});
it("changing an ancestor permanently blocks already produced descendants and further dispatch", () => {
  vi.useFakeTimers();
  const { w, a, b, c } = fixture();
  finish(w, a.id);
  approve(w, a.id);
  finish(w, b.id);
  const old = w.stage(a.id);
  w.reviseStage(a.id, "New decision", "", "", "", {
    revision: old.revision,
    generation: old.reviewGeneration,
  });
  expect(w.stage(b.id).dependencyStale).toBe(true);
  expect(w.stage(c.id).dependencyStale).toBe(true);
  expect(() => approve(w, b.id)).toThrow(/ancestor|dependency/i);
  approve(w, a.id);
  const d = new DemoDispatcher(w);
  const timer = vi.spyOn(globalThis, "setTimeout");
  expect(() => d.start(c.id, w.previewStart(c.id).token)).toThrow(
    /ancestor|dependency/i,
  );
  expect(timer).toHaveBeenCalledTimes(0);
  expect(w.tasks(c.id)).toHaveLength(0);
  d.close();
});
it("full prior checkpoint, source snapshot, evidence and dependency identities survive revision/export", () => {
  const { w, a } = fixture();
  finish(w, a.id);
  w.reviseStage(
    a.id,
    "UNIQUE OLD PROPOSAL",
    "OLD ASSUMPTION",
    "OLD GAP",
    "OLD ALTERNATIVE",
    { revision: 1, generation: w.stage(a.id).reviewGeneration },
  );
  approve(w, a.id);
  w.reviseStage(a.id, "NEW PROPOSAL", "", "", "", {
    revision: 2,
    generation: w.stage(a.id).reviewGeneration,
  });
  const event = w
    .exportProject(a.projectId)
    .events.find((e) => e.action === "approve")!;
  expect(event.checkpoint?.proposal).toBe("UNIQUE OLD PROPOSAL");
  expect(event.checkpoint?.assumptions).toBe("OLD ASSUMPTION");
  expect(event.evidence?.[0]?.output).toBe("FULL EVIDENCE");
  expect(event.snapshot?.items[0]?.text).toBe("PREVIEWED");
  expect(event.checkpointDigest).toMatch(/^[a-f0-9]{64}$/);
});

it("a launch token also binds the exact ancestor approval generation, not merely its approved status", () => {
  vi.useFakeTimers();
  const { w, a, b } = fixture();
  finish(w, a.id);
  approve(w, a.id);
  const preview = w.previewStart(b.id);
  w.review(
    a.id,
    1,
    "reject",
    "New explicit rejection",
    w.stage(a.id).reviewGeneration,
    randomUUID(),
  );
  approve(w, a.id);
  const dispatcher = new DemoDispatcher(w);
  const dispatchSchedule = vi.spyOn(globalThis, "setTimeout");
  expect(() => dispatcher.start(b.id, preview.token)).toThrow(/stale/i);
  expect(dispatchSchedule).toHaveBeenCalledTimes(0);
  expect(w.tasks(b.id)).toHaveLength(0);
  dispatcher.start(b.id, w.previewStart(b.id).token);
  expect(dispatchSchedule).toHaveBeenCalledTimes(1);
  dispatcher.close();
});
it("changing a consumed ancestor while a descendant runs never stops or blesses that work", () => {
  const { w, a, b, c } = fixture();
  finish(w, a.id);
  approve(w, a.id);
  const [running] = w.startStage(b.id, w.previewStart(b.id).token);
  const before = w.stage(a.id);
  w.reviseStage(a.id, "Revised parent", "", "", "", {
    revision: before.revision,
    generation: before.reviewGeneration,
  });
  expect(w.tasks(b.id)[0]?.status).toBe("running");
  w.recordResult(running!.id, "completed", "STALE BUT RETAINED RESULT");
  expect(w.stage(b.id).dependencyStale).toBe(true);
  expect(() => approve(w, b.id)).toThrow(/ancestor|dependency/);
  expect(w.tasks(c.id)).toHaveLength(0);
});
it("a stale proposal editor cannot overwrite a newer decision, and failed admission rolls back entirely", () => {
  vi.useFakeTimers();
  const { w, a, b } = fixture();
  finish(w, a.id);
  const before = w.stage(a.id);
  approve(w, a.id);
  expect(() =>
    w.reviseStage(a.id, "STALE EDIT", "", "", "", {
      revision: before.revision,
      generation: before.reviewGeneration,
    }),
  ).toThrow(/stale/i);
  expect(w.stage(a.id).status).toBe("approved");
  const token = w.previewStart(b.id).token;
  const dispatcher = new DemoDispatcher(w);
  const schedule = vi.spyOn(globalThis, "setTimeout");
  // SQLite itself fails the task insert after snapshot/stage mutation, exercising transaction rollback.
  w.store.db.exec(
    "CREATE TRIGGER fail_task BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'synthetic insert failure'); END;",
  );
  expect(() => dispatcher.start(b.id, token)).toThrow(
    /synthetic insert failure/,
  );
  expect(schedule).toHaveBeenCalledTimes(0);
  expect(w.stage(b.id).status).toBe("draft");
  expect(w.stage(b.id).snapshotId).toBeNull();
  expect(w.tasks(b.id)).toHaveLength(0);
  expect(w.exportProject(a.projectId).snapshots).toHaveLength(1);
  dispatcher.close();
});
