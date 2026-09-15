import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { expect, it } from "vitest";
import { GatewayAdapter } from "../server/gateway.js";
it("requires an explicit server bootstrap secret, with no demo fallback", async () => {
  const adapter = new GatewayAdapter({ origin: "http://127.0.0.1:4317" });
  await expect(adapter.connect()).rejects.toThrow(/server-side/);
  expect(adapter.connection().canExecute).toBe(false);
  await expect(adapter.history("demo:harbor", 0, 50)).rejects.toThrow(
    /selected/,
  );
});
it("performs challenge-bound read-only handshake and filters selected sessions against mock protocol server", async () => {
  const server = createServer();
  const sockets = new WebSocketServer({ server });
  const methods: string[] = [];
  let connect: Record<string, unknown> = {};
  sockets.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "synthetic-nonce", ts: Date.now() },
      }),
    );
    socket.on("message", (bytes) => {
      const frame = JSON.parse(bytes.toString()) as {
        id: string;
        method: string;
        params: Record<string, unknown>;
      };
      methods.push(frame.method);
      let payload: unknown = {};
      if (frame.method === "connect") {
        connect = frame.params;
        payload = {
          type: "hello-ok",
          protocol: 4,
          server: { version: "2026.8.1", connId: "fixture" },
          features: { methods: ["sessions.list", "chat.history"], events: [] },
          snapshot: {
            presence: [],
            health: {},
            stateVersion: { presence: 0, health: 0 },
            uptimeMs: 1,
          },
          auth: { role: "operator", scopes: ["operator.read"] },
          policy: {
            maxPayload: 1048576,
            maxBufferedBytes: 1048576,
            tickIntervalMs: 30000,
          },
        };
      }
      if (frame.method === "sessions.list")
        payload = {
          sessions: [
            {
              key: "fixture:1",
              sessionId: "instance-1",
              label: "Synthetic protocol conversation",
            },
          ],
          hasMore: false,
        };
      if (frame.method === "chat.history")
        payload = {
          sessionId: "instance-1",
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: [{ type: "text", text: "Synthetic protocol text" }],
            },
          ],
          hasMore: false,
        };
      socket.send(
        JSON.stringify({ type: "res", id: frame.id, ok: true, payload }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No socket");
  const adapter = new GatewayAdapter({
    origin: "http://127.0.0.1:4317",
    url: `ws://127.0.0.1:${address.port}`,
    bootstrapToken: "synthetic-fixture-only",
  });
  try {
    await adapter.connect();
    expect(connect.scopes).toEqual(["operator.read"]);
    expect(connect.device).toMatchObject({ nonce: "synthetic-nonce" });
    expect(connect.client).toMatchObject({ id: "gateway-client", mode: "ui" });
    const sessions = await adapter.list();
    expect(sessions[0]?.title).toBe("Synthetic protocol conversation");
    await expect(adapter.history("fixture:1", 0, 50)).rejects.toThrow(
      /selected/,
    );
    adapter.select("fixture:1");
    expect((await adapter.history("fixture:1", 0, 50)).messages[0]?.text).toBe(
      "Synthetic protocol text",
    );
    expect(methods).toEqual(["connect", "sessions.list", "chat.history"]);
    expect(adapter.connection().state).toBe("read_only_unverified");
  } finally {
    adapter.close();
    sockets.clients.forEach((socket) => socket.terminate());
    await new Promise<void>((resolve) => sockets.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
