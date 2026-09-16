import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { GatewayAdapter } from "../server/gateway.js";
import type {
  Catalog,
  CatalogUnavailable,
  Project,
  WorkspaceState,
} from "../shared/types.js";
let server: Server;
let store: Store;
let origin: string;
let cookie: string;
let csrf: string;
let stop: () => void;
async function boot(mode: "demo" | "live") {
  store = new Store(":memory:", mode);
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No socket");
  origin = `http://127.0.0.1:${address.port}`;
  const gateway =
    mode === "live" ? new GatewayAdapter({ origin }) : undefined;
  const app = createApp({ store, mode, origin, gateway });
  stop = app.close;
  server.on("request", app.handler);
  const response = await fetch(`${origin}/api/v1/bootstrap`);
  cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  csrf = ((await response.json()) as { csrf: string }).csrf;
}
function post(path: string, body: unknown) {
  return fetch(`${origin}/api/v1${path}`, {
    method: "POST",
    headers: {
      cookie,
      origin,
      "content-type": "application/json",
      "x-csrf-token": csrf,
    },
    body: JSON.stringify(body),
  });
}
afterEach(async () => {
  stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
});
it("returns a synthetic, available catalog in demo mode without requiring conversation selection", async () => {
  await boot("demo");
  const response = await fetch(`${origin}/api/v1/catalog`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as Catalog;
  expect(body.available).toBe(true);
  expect(body.synthetic).toBe(true);
  expect(body.pages.length).toBeGreaterThan(0);
  expect(body.skills.length).toBeGreaterThan(0);
});
it("reports unavailable with a reason in live mode, never a silent empty catalog", async () => {
  await boot("live");
  const response = await fetch(`${origin}/api/v1/catalog`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as CatalogUnavailable;
  expect(body.available).toBe(false);
  expect(typeof body.reason).toBe("string");
  expect(body.reason.length).toBeGreaterThan(0);
});
it("rejects unauthenticated requests the same as other routes", async () => {
  await boot("demo");
  const response = await fetch(`${origin}/api/v1/catalog`);
  expect(response.status).toBe(401);
});
it("rejects cross-origin fetch metadata the same as other routes", async () => {
  await boot("demo");
  const response = await fetch(`${origin}/api/v1/catalog`, {
    headers: { cookie, "sec-fetch-site": "cross-site" },
  });
  expect(response.status).toBe(403);
});
it("creates a project from a server-resolved catalog selection, ignoring client-supplied text", async () => {
  await boot("demo");
  const response = await post("/catalog/projects", {
    refs: [{ kind: "wiki", pageId: "wiki-harbor-overview" }],
    name: "Catalog picks",
    lifetime: "short_term",
  });
  expect(response.status).toBe(200);
  const project = (await response.json()) as Project;
  const state = (await (
    await fetch(`${origin}/api/v1/state`, { headers: { cookie } })
  ).json()) as WorkspaceState;
  const item = state.context.find(
    (entry) => entry.projectId === project.id,
  )!;
  expect(item.kind).toBe("catalog_reference");
  expect(item.source.gateway).toBe("catalog");
});
it("rejects an unknown wiki page id rather than trusting client text", async () => {
  await boot("demo");
  const response = await post("/catalog/projects", {
    refs: [{ kind: "wiki", pageId: "not-a-real-page" }],
    name: "Bad",
    lifetime: "short_term",
  });
  expect(response.status).toBe(409);
});
it("adds a skill artifact reference to an existing project via catalog-context", async () => {
  await boot("demo");
  const created = await post("/catalog/projects", {
    refs: [{ kind: "wiki", pageId: "wiki-harbor-overview" }],
    name: "Base",
    lifetime: "short_term",
  });
  const project = (await created.json()) as Project;
  const added = await post(`/projects/${project.id}/catalog-context`, {
    refs: [
      {
        kind: "skill",
        skillId: "skill-field-notes",
        artifactId: "skill-field-notes:instructions",
      },
    ],
  });
  expect(added.status).toBe(200);
  const state = (await (
    await fetch(`${origin}/api/v1/state`, { headers: { cookie } })
  ).json()) as WorkspaceState;
  expect(
    state.context.filter((entry) => entry.projectId === project.id),
  ).toHaveLength(2);
});
it("disables catalog save routes outside demo mode", async () => {
  await boot("live");
  const response = await post("/catalog/projects", {
    refs: [{ kind: "wiki", pageId: "wiki-harbor-overview" }],
    name: "Live",
    lifetime: "short_term",
  });
  expect(response.status).toBe(409);
});
