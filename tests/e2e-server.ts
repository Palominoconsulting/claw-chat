import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { addDemoMessage } from "../server/demo.js";
const dir = mkdtempSync(".data-e2e-");
const store = new Store(join(dir, "fixture.sqlite"), "demo");
// This single server backs the entire Playwright suite (37+ tests as of
// 2026-09-16), each opening its own browser context/cookie and therefore its
// own in-memory browser session (server/security.ts). The production
// default cap of 32 concurrent sessions is sized for a real local user, not
// a full single-process e2e run; raise it here only, so real usage keeps
// the conservative default.
const app = createApp({
  store,
  mode: "demo",
  origin: "http://127.0.0.1:4318",
  maxSessions: 256,
});
store.transaction(() => {
  for (let i = 0; i < 10000; i++)
    addDemoMessage(
      store,
      "demo:shore",
      `Synthetic bounded transcript entry ${i}. No real user data.`,
      "assistant",
      `large-${i}`,
    );
});
const server = createServer(app.handler).listen(4318, "127.0.0.1");
process.on("SIGTERM", () => {
  app.close();
  server.close(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
});
