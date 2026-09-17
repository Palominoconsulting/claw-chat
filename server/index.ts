import { resolve } from "node:path";
import { GatewayAdapter } from "./gateway.js";
import { startLocal } from "./startup.js";
async function main() {
  const port = Number(process.env.PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("PORT must be 1024–65535");
  const mode = process.env.APP_MODE ?? "demo";
  if (mode !== "demo" && mode !== "live")
    throw new Error("APP_MODE must be demo or live");
  const origin = process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  process.umask(0o077);
  const path = resolve(process.env.DATA_FILE ?? `.data/${mode}.sqlite`);
  try {
    const service = await startLocal({
      path,
      mode,
      origin,
      port,
      gateway:
        mode === "live"
          ? new GatewayAdapter({
              origin,
              url: process.env.GATEWAY_URL,
              bootstrapToken: process.env.GATEWAY_BOOTSTRAP_TOKEN,
            })
          : undefined,
    });
    const shutdown = () => {
      void service.close();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    service.server.on("error", () => {
      shutdown();
      process.stderr.write(
        "claw-chat listener failed. No network configuration was changed.\n",
      );
      process.exitCode = 1;
    });
    process.stdout.write(
      `claw-chat ${mode}: local listener ready on port ${port}. Live certification: unverified.\n`,
    );
  } catch {
    process.stderr.write(
      "claw-chat startup failed. Check origin, port and database owner lock. No lock was taken over and no network configuration was changed.\n",
    );
    process.exitCode = 1;
  }
}
void main();
