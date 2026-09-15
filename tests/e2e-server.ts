import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { addDemoMessage } from "../server/demo.js";
const dir = mkdtempSync(".data-e2e-");
const store = new Store(join(dir, "fixture.sqlite"), "demo");
const app = createApp({ store, mode: "demo", origin: "http://127.0.0.1:4318" });
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
