import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { Store } from "../server/store.js";
import { Workspace } from "../server/domain.js";
import { seedDemo, demoHistory } from "../server/demo.js";
const dirs: string[] = [];
afterEach(() =>
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);
function location() {
  const dir = mkdtempSync(".data-test-");
  dirs.push(dir);
  return join(dir, "test.sqlite");
}
it("restart preserves projects and marks ambiguous work unknown, never dispatching", () => {
  const path = location();
  const first = new Store(path, "demo");
  const workspace = new Workspace(first);
  const project = workspace.createProject("Synthetic restart", "short_term", [
    {
      text: "Only test data",
      author: "Test",
      source: {
        gateway: "demo",
        operator: "test",
        sessionKey: "test",
        sessionId: "test-1",
        messageId: "m1",
      },
    },
  ]);
  const stage = workspace.createStage(project.id, "Research", [
    { objective: "Read", acceptance: "Report" },
  ]);
  const launchToken = workspace.previewStart(stage.id).token;
  workspace.startStage(stage.id, launchToken);
  first.close();
  const second = new Store(path, "demo");
  const recovered = new Workspace(second);
  recovered.recover();
  expect(recovered.project(project.id)).toEqual(project);
  expect(recovered.tasks(stage.id)[0]?.status).toBe("unknown");
  expect(recovered.startStage(stage.id, launchToken)).toEqual([]);
  expect(() =>
    recovered.review(
      stage.id,
      1,
      "approve",
      "Checked",
      recovered.stage(stage.id).reviewGeneration,
      randomUUID(),
    ),
  ).toThrow(/accounted/);
  second.close();
});
it("does not reseed removed demo messages on restart", () => {
  const path = location();
  const first = new Store(path, "demo");
  seedDemo(first);
  expect(demoHistory(first, "demo:harbor", 0).messages).toHaveLength(4);
  first.db.exec("DELETE FROM messages");
  first.close();
  const second = new Store(path, "demo");
  seedDemo(second);
  expect(demoHistory(second, "demo:harbor", 0).messages).toHaveLength(0);
  second.close();
});
it("refuses a store from the other source mode", () => {
  const path = location();
  const first = new Store(path, "demo");
  first.close();
  expect(() => new Store(path, "live")).toThrow(/mismatch/);
});
it("initial migration rollback and forward replay are valid on a disposable database", () => {
  const store = new Store(":memory:", "demo");
  store.db.exec(readFileSync("server/schema/001-initial.down.sql", "utf8"));
  store.db.exec(readFileSync("server/schema/001-initial.sql", "utf8"));
  expect(store.all("projects")).toEqual([]);
  store.close();
});
it("migrates original source metadata without inventing an older edited excerpt", () => {
  const store = new Store(":memory:", "demo");
  const workspace = new Workspace(store);
  const project = workspace.createProject("Migration fixture", "short_term", [
    {
      text: "Original observation",
      author: "Synthetic",
      source: {
        gateway: "demo",
        operator: "fixture",
        sessionKey: "fixture",
        sessionId: "one",
        messageId: "one",
      },
    },
  ]);
  const item = workspace.context(project.id)[0]!;
  workspace.editContext(project.id, item.id, "note", "An interpretation");
  store.db.exec(
    readFileSync("server/schema/002-original-excerpts.down.sql", "utf8"),
  );
  store.db.exec(
    readFileSync("server/schema/002-original-excerpts.sql", "utf8"),
  );
  expect(workspace.context(project.id)[0]?.originalText).toBeNull();
  store.close();
});

it("review receipts and full historical checkpoint bodies survive restart without replaying stale approval", () => {
  const path = location();
  const store = new Store(path, "demo");
  const w = new Workspace(store);
  const p = w.createProject("Historical review fixture", "short_term", [
    {
      text: "SOURCE",
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
  const a = w.createStage(p.id, "Review", [
    { objective: "Observe", acceptance: "Evidence" },
  ]);
  const token = w.previewStart(a.id).token;
  w.startStage(a.id, token).forEach((t) =>
    w.recordResult(t.id, "completed", "FULL OLD EVIDENCE"),
  );
  w.reviseStage(
    a.id,
    "OLD APPROVED CONTENT",
    "ASSUMPTION",
    "GAP",
    "ALTERNATIVE",
    { revision: 1, generation: 0 },
  );
  const generation = w.stage(a.id).reviewGeneration;
  const requestId = randomUUID();
  w.review(a.id, 2, "approve", "Approved once", generation, requestId);
  const approvedExport = w.exportProject(p.id);
  store.close();
  const reopened = new Store(path, "demo");
  const second = new Workspace(reopened);
  second.review(a.id, 2, "approve", "Approved once", generation, requestId);
  expect(second.exportProject(p.id).events).toEqual(approvedExport.events);
  second.review(
    a.id,
    2,
    "reject",
    "New deliberate choice",
    second.stage(a.id).reviewGeneration,
    randomUUID(),
  );
  expect(() =>
    second.review(a.id, 2, "approve", "Approved once", generation, requestId),
  ).toThrow(/stale/i);
  expect(second.stage(a.id).status).toBe("rejected");
  expect(
    second.exportProject(p.id).events.find((e) => e.action === "approve")
      ?.checkpoint?.proposal,
  ).toBe("OLD APPROVED CONTENT");
  expect(second.startStage(a.id, token)).toEqual([]);
  reopened.close();
});
it("v3 migration preserves old work but blocks unsupported historical authority", () => {
  const path = location();
  const store = new Store(path, "demo");
  const w = new Workspace(store);
  const p = w.createProject("Legacy admitted work", "short_term", [
    {
      text: "OLD SOURCE",
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
  const a = w.createStage(p.id, "Legacy stage", [
    { objective: "Observe", acceptance: "Evidence" },
  ]);
  w.startStage(a.id, w.previewStart(a.id).token).forEach((t) =>
    w.recordResult(t.id, "completed", "PRESERVED OUTPUT"),
  );
  w.review(a.id, 1, "approve", "Legacy approval", 0, randomUUID());
  store.db.exec(
    "UPDATE stages SET data=json_remove(data,'$.reviewGeneration','$.launchToken','$.dependencies','$.dependencyStale'); PRAGMA user_version=3;",
  );
  store.close();
  const upgraded = new Store(path, "demo");
  const second = new Workspace(upgraded);
  expect(second.stage(a.id)).toMatchObject({
    dependencyStale: true,
    approvedRevision: null,
    status: "review",
  });
  expect(second.tasks(a.id)[0]?.output).toBe("PRESERVED OUTPUT");
  expect(() =>
    second.review(a.id, 1, "approve", "Cannot recertify", 0, randomUUID()),
  ).toThrow(/dependency|ancestor/);
  expect(upgraded.db.prepare("PRAGMA user_version").get()?.user_version).toBe(
    4,
  );
  upgraded.close();
});
