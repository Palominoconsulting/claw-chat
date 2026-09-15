import { createServer } from "node:http";
import { resolve } from "node:path";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { Store } from "./store.js";
import { GatewayAdapter } from "./gateway.js";
import { createApp } from "./app.js";
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be 1024–65535");
const mode = process.env.APP_MODE ?? "demo";
if (mode !== "demo" && mode !== "live")
  throw new Error("APP_MODE must be demo or live");
const origin = process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
process.umask(0o077);
const path = resolve(process.env.DATA_FILE ?? `.data/${mode}.sqlite`);
const store = new Store(path, mode);
const lock = `${path}.lock`;
let fd: number;
try {
  fd = openSync(lock, "wx", 0o600);
} catch {
  store.close();
  throw new Error(
    "Database has an owner lock. Stop its process first. If a crash left the lock, remove only that .lock after verifying no claw-chat process is running.",
  );
}
const gateway =
  mode === "live"
    ? new GatewayAdapter({
        origin,
        url: process.env.GATEWAY_URL,
        bootstrapToken: process.env.GATEWAY_BOOTSTRAP_TOKEN,
      })
    : undefined;
const app = createApp({ store, mode, origin, gateway });
const server = createServer(app.handler);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  app.close();
  server.close(() => {
    store.close();
    closeSync(fd);
    unlinkSync(lock);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.on("error", () => {
  shutdown();
  process.stderr.write(
    "claw-chat could not bind its local port. No network configuration was changed.\n",
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `claw-chat ${mode}: local listener ready on port ${port}. Live certification: unverified.\n`,
  );
});
