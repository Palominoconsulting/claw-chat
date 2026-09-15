import { createServer } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { GatewayAdapter } from "../server/gateway.js";
import type { Message, MessagePage } from "../shared/types.js";
let stop: () => Promise<void>;
let get: (path: string) => Promise<Response>;
let post: (path: string, body: unknown) => Promise<Response>;
let history: ReturnType<typeof vi.spyOn>;
const message = (text: string): Message => ({
  id: "same",
  text,
  author: "Synthetic",
  role: "assistant",
  simulated: false,
  createdAt: "",
  source: {
    gateway: "synthetic-gateway",
    operator: "synthetic",
    sessionKey: "test",
    sessionId: "one",
    messageId: "same",
  },
});
beforeEach(async () => {
  const store = new Store(":memory:", "live");
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("socket");
  const origin = `http://127.0.0.1:${address.port}`;
  const gateway = new GatewayAdapter({ origin });
  vi.spyOn(gateway, "select").mockImplementation(() => {});
  history = vi.spyOn(gateway, "history").mockResolvedValue({
    messages: [message("OLD EXACT")],
    nextOffset: null,
    incomplete: false,
  });
  const app = createApp({ store, mode: "live", origin, gateway });
  server.on("request", app.handler);
  const bootstrap = await fetch(`${origin}/api/v1/bootstrap`);
  const cookie = bootstrap.headers.get("set-cookie")!.split(";")[0]!;
  const { csrf } = (await bootstrap.json()) as { csrf: string };
  get = (path) => fetch(`${origin}/api/v1${path}`, { headers: { cookie } });
  post = (path, body) =>
    fetch(`${origin}/api/v1${path}`, {
      method: "POST",
      headers: {
        cookie,
        origin,
        "content-type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(body),
    });
  stop = async () => {
    app.close();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  };
  await post("/select", { key: "test" });
});
afterEach(async () => {
  await stop();
  vi.restoreAllMocks();
});
it("tab B refresh cannot replace tab A's immutable exact source candidate", async () => {
  const a = (await (await get("/history?key=test")).json()) as MessagePage;
  history.mockResolvedValue({
    messages: [message("NEW OTHER TAB")],
    nextOffset: null,
    incomplete: false,
  });
  await get("/history?key=test");
  const result = await post("/projects", {
    name: "Exact",
    lifetime: "short_term",
    key: "test",
    messageIds: ["same"],
    pageToken: a.pageToken,
  });
  expect(result.status).toBe(200);
  const state = (await (await get("/state")).json()) as {
    context: { text: string }[];
  };
  expect(state.context[0]?.text).toBe("OLD EXACT");
});
it("duplicate source identities fail closed before capture", async () => {
  history.mockResolvedValue({
    messages: [message("FIRST"), message("SECOND")],
    nextOffset: null,
    incomplete: false,
  });
  expect((await get("/history?key=test")).status).toBe(409);
  expect(
    (
      await post("/projects", {
        name: "Ambiguous",
        lifetime: "short_term",
        key: "test",
        messageIds: ["same"],
      })
    ).status,
  ).toBe(400);
});
it("unbound or forged source requests cannot create context", async () => {
  const page = (await (await get("/history?key=test")).json()) as MessagePage;
  const body = {
    name: "Exact",
    lifetime: "short_term",
    key: "test",
    messageIds: ["same"],
  };
  expect((await post("/projects", body)).status).toBe(400);
  expect(
    (await post("/projects", { ...body, pageToken: "not-a-candidate" })).status,
  ).toBe(409);
  expect(
    (
      await post("/projects", {
        ...body,
        pageToken: page.pageToken,
        text: "FORGED",
      })
    ).status,
  ).toBe(400);
});

it("candidate expiry and bounded eviction fail closed instead of resolving current IDs", async () => {
  const old = (await (await get("/history?key=test")).json()) as MessagePage;
  await Promise.all(Array.from({ length: 8 }, () => get("/history?key=test")));
  const body = {
    name: "Expired",
    lifetime: "short_term",
    key: "test",
    messageIds: ["same"],
  };
  expect(
    (await post("/projects", { ...body, pageToken: old.pageToken })).status,
  ).toBe(409);
  const recent = (await (await get("/history?key=test")).json()) as MessagePage;
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 600001);
  expect(
    (await post("/projects", { ...body, pageToken: recent.pageToken })).status,
  ).toBe(409);
});
it("a delayed history request cannot cross a selection generation, including A-to-B-to-A", async () => {
  let deliver!: (value: MessagePage) => void;
  let requested!: () => void;
  const pendingRequest = new Promise<void>((resolve) => {
    requested = resolve;
  });
  history.mockImplementationOnce(() => {
    requested();
    return new Promise<MessagePage>((resolve) => {
      deliver = resolve;
    });
  });
  const pending = get("/history?key=test");
  await pendingRequest;
  await post("/select", { key: "other" });
  await post("/select", { key: "test" });
  deliver({
    messages: [message("OLD REQUEST")],
    nextOffset: null,
    incomplete: false,
  });
  expect((await pending).status).toBe(409);
});
it("two concurrent history replies each retain their own exact content and provenance", async () => {
  let deliver!: (value: MessagePage) => void;
  let requested!: () => void;
  const pendingRequest = new Promise<void>((resolve) => {
    requested = resolve;
  });
  history.mockImplementationOnce(() => {
    requested();
    return new Promise<MessagePage>((resolve) => {
      deliver = resolve;
    });
  });
  const first = get("/history?key=test");
  await pendingRequest;
  history.mockResolvedValue({
    messages: [{ ...message("NEWER"), author: "New author" }],
    nextOffset: null,
    incomplete: false,
  });
  const second = (await (await get("/history?key=test")).json()) as MessagePage;
  deliver({
    messages: [message("OLDER REQUEST")],
    nextOffset: null,
    incomplete: false,
  });
  const older = (await (await first).json()) as MessagePage;
  expect(older.pageToken).not.toBe(second.pageToken);
  expect(
    (
      await post("/projects", {
        name: "Newer selected",
        lifetime: "short_term",
        key: "test",
        pageToken: second.pageToken,
        messageIds: ["same"],
      })
    ).status,
  ).toBe(200);
  const state = (await (await get("/state")).json()) as {
    context: { text: string; author: string }[];
  };
  expect(state.context[0]).toMatchObject({
    text: "NEWER",
    author: "New author",
  });
});
