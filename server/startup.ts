import { createServer } from "node:http";
import type { Mode } from "../shared/types.js";
import { Security } from "./security.js";
import { Store } from "./store.js";
import { createApp } from "./app.js";
import type { GatewayAdapter } from "./gateway.js";

// All initialization after acquiring ownership lives in one cleanup scope.
export async function startLocal(options: {
  path: string;
  mode: Mode;
  origin: string;
  port: number;
  gateway?: GatewayAdapter;
}) {
  const validatedOrigin = new Security(options.origin).origin; // Validate before database writes.
  const store = new Store(options.path, options.mode);
  let app: ReturnType<typeof createApp> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  try {
    app = createApp({
      store,
      mode: options.mode,
      origin: validatedOrigin,
      gateway: options.gateway,
    });
    server = createServer(app.handler);
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(options.port, "127.0.0.1", () => {
        server!.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    try {
      app?.close();
      server?.close();
    } finally {
      store.close();
    }
    throw error;
  }
  const ownedApp = app;
  const ownedServer = server;
  let closing: Promise<void> | undefined;
  return {
    server: ownedServer,
    close: () => {
      closing ??= new Promise<void>((resolve) => {
        ownedApp.close();
        ownedServer.close(() => {
          store.close();
          resolve();
        });
      });
      return closing;
    },
  };
}
