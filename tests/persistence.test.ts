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
  workspace.startStage(stage.id);
  first.close();
  const second = new Store(path, "demo");
  const recovered = new Workspace(second);
  recovered.recover();
  expect(recovered.project(project.id)).toEqual(project);
  expect(recovered.tasks(stage.id)[0]?.status).toBe("unknown");
  expect(recovered.startStage(stage.id)).toEqual([]);
  expect(() => recovered.review(stage.id, 1, "approve", "Checked")).toThrow(
    /accounted/,
  );
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
