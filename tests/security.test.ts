import { afterEach, beforeEach, expect, it } from "vitest";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
let server: Server;
let store: Store;
let origin: string;
let cookie: string;
let csrf: string;
let stop: () => void;
beforeEach(async () => {
  store = new Store(":memory:", "demo");
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No socket");
  origin = `http://127.0.0.1:${address.port}`;
  const app = createApp({ store, mode: "demo", origin });
  stop = app.close;
  server.on("request", app.handler);
  const response = await fetch(`${origin}/api/v1/bootstrap`);
  cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  csrf = ((await response.json()) as { csrf: string }).csrf;
});
afterEach(async () => {
  stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});
function post(
  path: string,
  body: unknown = {},
  headers: Record<string, string> = {},
) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin,
      "x-csrf-token": csrf,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
it("sets HttpOnly SameSite cookie and no-store, strict CSP", async () => {
  const response = await fetch(`${origin}/api/v1/bootstrap`);
  expect(response.headers.get("set-cookie")).toMatch(
    /HttpOnly; SameSite=Strict/,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-security-policy")).toContain(
    "default-src 'self'",
  );
});
it("rejects cross-origin writes even with valid cookie and CSRF", async () => {
  expect(
    (await post("/api/v1/projects", {}, { origin: "https://attacker.invalid" }))
      .status,
  ).toBe(403);
});
it("rejects rebinding Host headers", async () => {
  const status = await new Promise<number | undefined>((resolve) => {
    const req = request(
      `${origin}/api/v1/bootstrap`,
      { headers: { host: "attacker.invalid" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.end();
  });
  expect(status).toBe(403);
});
it("rejects foreign browser bootstrap and read requests", async () => {
  expect(
    (
      await fetch(`${origin}/api/v1/bootstrap`, {
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`${origin}/api/v1/state`, {
        headers: { cookie, origin: "https://attacker.invalid" },
      })
    ).status,
  ).toBe(403);
});
it("requires session, CSRF, JSON and explicit Origin for writes", async () => {
  expect(
    (await post("/api/v1/projects", {}, { "x-csrf-token": "" })).status,
  ).toBe(403);
  expect((await post("/api/v1/projects", {}, { cookie: "" })).status).toBe(401);
  expect((await post("/api/v1/projects", {}, { origin: "" })).status).toBe(403);
  expect(
    (await post("/api/v1/projects", {}, { "content-type": "text/plain" }))
      .status,
  ).toBe(415);
});
it("does not expose transcripts before explicit server-side selection", async () => {
  expect(
    (
      await fetch(`${origin}/api/v1/history?key=demo%3Aharbor`, {
        headers: { cookie },
      })
    ).status,
  ).toBe(403);
  await post("/api/v1/select", { key: "demo:harbor" });
  const response = await fetch(`${origin}/api/v1/history?key=demo%3Aharbor`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
});
it("chat accepts literal HTML as inert text, only from selected sessions", async () => {
  await post("/api/v1/select", { key: "demo:harbor" });
  const result = await post("/api/v1/chat", {
    key: "demo:harbor",
    text: "<script>alert(1)</script>",
  });
  expect(result.status).toBe(200);
  const response = await fetch(`${origin}/api/v1/history?key=demo%3Aharbor`, {
    headers: { cookie },
  });
  expect(await response.text()).toContain("<script>alert(1)</script>");
});
it("resolves selected excerpts server-side instead of trusting client-supplied provenance", async () => {
  await post("/api/v1/select", { key: "demo:harbor" });
  const response = await post("/api/v1/projects", {
    name: "Test project",
    lifetime: "short_term",
    key: "demo:harbor",
    messageIds: ["m1"],
    text: "forged",
  });
  expect(response.status).toBe(400);
});
it("caps history page size and disallows arbitrary Gateway RPCs", async () => {
  await post("/api/v1/select", { key: "demo:harbor" });
  expect(
    (
      await fetch(`${origin}/api/v1/history?key=demo%3Aharbor&limit=10000`, {
        headers: { cookie },
      })
    ).status,
  ).toBe(400);
  expect((await post("/api/v1/rpc", { method: "config.set" })).status).toBe(
    404,
  );
});

it("requires explicit launch and review concurrency contracts at the HTTP boundary", async () => {
  const { Workspace } = await import("../server/domain.js");
  const w = new Workspace(store);
  const project = w.createProject("Synthetic HTTP CAS", "short_term", [
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
  const stage = w.createStage(project.id, "Observe", [
    { objective: "Observe", acceptance: "Evidence" },
  ]);
  expect((await post(`/api/v1/stages/${stage.id}/start`, {})).status).toBe(400);
  expect(w.tasks(stage.id)).toHaveLength(0);
  const token = w.previewStart(stage.id).token;
  const item = w.context(project.id)[0]!;
  w.editContext(project.id, item.id, "note", "UNSEEN");
  expect(
    (await post(`/api/v1/stages/${stage.id}/start`, { token })).status,
  ).toBe(409);
  expect(w.tasks(stage.id)).toHaveLength(0);
  w.startStage(stage.id, w.previewStart(stage.id).token).forEach((task) =>
    w.recordResult(task.id, "completed", "RESULT"),
  );
  expect(
    (
      await post(`/api/v1/stages/${stage.id}/review`, {
        revision: 1,
        action: "approve",
        note: "Missing CAS",
      })
    ).status,
  ).toBe(400);
  const approve = {
    revision: 1,
    generation: 0,
    requestId: crypto.randomUUID(),
    action: "approve",
    note: "First tab",
  };
  const reject = {
    ...approve,
    requestId: crypto.randomUUID(),
    action: "reject",
    note: "Second tab",
  };
  const responses = await Promise.all([
    post(`/api/v1/stages/${stage.id}/review`, approve),
    post(`/api/v1/stages/${stage.id}/review`, reject),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    w
      .exportProject(project.id)
      .events.filter((e) => ["approve", "reject"].includes(e.action)),
  ).toHaveLength(1);
});
