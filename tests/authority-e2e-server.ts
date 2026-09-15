import { createServer } from "node:http";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
const store = new Store(":memory:", "demo");
const app = createApp({ store, mode: "demo", origin: "http://127.0.0.1:4329" });
const server = createServer(app.handler).listen(4329, "127.0.0.1");
process.on("SIGTERM", () => {
  app.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
});
