import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { z, ZodError } from "zod";
import type {
  ContextItem,
  Message,
  Mode,
  Project,
  ReviewEvent,
  WorkspaceState,
} from "../shared/types.js";
import type { Store } from "./store.js";
import { Workspace } from "./domain.js";
import {
  addDemoMessage,
  demoConversations,
  demoHistory,
  DemoDispatcher,
  seedDemo,
} from "./demo.js";
import { GatewayAdapter } from "./gateway.js";
import { HttpError, Security, jsonBody } from "./security.js";
import {
  catalogUnavailable,
  resolveCatalogExcerpts,
  syntheticCatalog,
} from "./catalog.js";
const keySchema = z.string().min(1).max(2000);
const selectionSchema = z.object({
  key: keySchema,
  pageToken: z.string().min(1).max(120),
  messageIds: z.array(z.string().min(1).max(2000)).min(1).max(50),
});
const lifetime = z.enum(["short_term", "long_term"]);
const kind = z.enum([
  "source_excerpt",
  "note",
  "constraint",
  "assumption",
  "proposed_decision",
  "approved_decision",
]);
const brief = z
  .object({
    objective: z.string().trim().min(1).max(2000),
    acceptance: z.string().trim().min(1).max(2000),
  })
  .strict();
const catalogRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wiki"), pageId: z.string().min(1).max(200) }).strict(),
  z
    .object({
      kind: z.literal("skill"),
      skillId: z.string().min(1).max(200),
      artifactId: z.string().min(1).max(200),
    })
    .strict(),
]);
const catalogSelectionSchema = z.object({
  refs: z.array(catalogRefSchema).min(1).max(50),
});
export interface AppOptions {
  store: Store;
  mode: Mode;
  origin: string;
  gateway?: GatewayAdapter;
  clientDir?: string;
  // Test-only override for the in-memory browser-session cap (default 32).
  // Long, single-server Playwright suites open more sessions than a real
  // user session ever would; this never changes production behavior.
  maxSessions?: number;
}
export function createApp(options: AppOptions) {
  const { store, mode } = options;
  const workspace = new Workspace(store);
  const security = new Security(options.origin, options.maxSessions);
  const gateway =
    options.gateway ?? new GatewayAdapter({ origin: options.origin });
  const dispatcher =
    mode === "demo" ? new DemoDispatcher(workspace) : undefined;
  if (mode === "demo") seedDemo(store);
  workspace.recover();
  const clientDir = resolve(options.clientDir ?? "dist/client");
  const connection = () =>
    mode === "demo"
      ? {
          mode: "demo" as const,
          state: "demo" as const,
          detail: "Synthetic demo. No model inference or Gateway access.",
          canExecute: true,
        }
      : gateway.connection();
  async function route(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<unknown> {
    security.headers(res);
    security.checkOrigin(req);
    const url = new URL(req.url ?? "/", options.origin);
    const rawPath = url.pathname;
    if (rawPath.startsWith("/api/") && !rawPath.startsWith("/api/v1/"))
      throw new HttpError(404, "Unsupported API version");
    const path = rawPath.replace(/^\/api\/v1\//, "/api/");
    if (path === "/api/bootstrap" && req.method === "GET")
      return {
        apiVersion: 1,
        csrf: security.bootstrap(req, res).csrf,
        connection: connection(),
      };
    if (!path.startsWith("/api/")) {
      if (!["GET", "HEAD"].includes(req.method ?? ""))
        throw new HttpError(405, "Method not allowed");
      const file = resolve(
        clientDir,
        path === "/" ? "index.html" : `.${decodeURIComponent(path)}`,
      );
      if (!file.startsWith(`${clientDir}${sep}`))
        throw new HttpError(404, "Not found");
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      try {
        const data = await readFile(file);
        res.setHeader(
          "Content-Type",
          mime[extname(file)] ?? "application/octet-stream",
        );
        res.end(req.method === "HEAD" ? undefined : data);
        return undefined;
      } catch {
        throw new HttpError(404, "Not found; run npm run build first");
      }
    }
    const session = security.authorize(req);
    const selected = (key: string) => {
      if (session.selected !== key)
        throw new HttpError(403, "Conversation must be explicitly selected");
    };
    const excerpts = (data: z.infer<typeof selectionSchema>) => {
      selected(data.key);
      const candidate = session.pages.get(data.pageToken);
      if (
        !candidate ||
        candidate.key !== data.key ||
        candidate.expires <= Date.now()
      )
        throw new HttpError(
          409,
          "Source preview expired or unavailable; reload and preview again",
        );
      const messages = JSON.parse(candidate.json) as Message[];
      if (new Set(data.messageIds).size !== data.messageIds.length)
        throw new HttpError(409, "Duplicate source selection is ambiguous");
      return data.messageIds.map((id) => {
        const matches = messages.filter(
          (item) => item.id === id && item.source.sessionKey === data.key,
        );
        if (matches.length !== 1)
          throw new HttpError(
            409,
            "Message no longer in the viewed page; reload and preview again",
          );
        const message = matches[0]!;
        return {
          text: message.text,
          author: message.author,
          source: message.source,
        };
      });
    };
    if (path === "/api/state" && req.method === "GET") {
      const state: WorkspaceState = {
        projects: store.all<Project>("projects"),
        stages: workspace.stages(),
        tasks: workspace.tasks(),
        context: store.all<ContextItem>("context_items"),
        events: store.all<ReviewEvent>("events"),
        connection: connection(),
        conversations: mode === "demo" ? demoConversations : [],
      };
      return state;
    }
    if (path === "/api/conversations" && req.method === "GET")
      return mode === "demo" ? demoConversations : await gateway.list();
    if (path === "/api/catalog" && req.method === "GET")
      return mode === "demo"
        ? syntheticCatalog()
        : catalogUnavailable(
            "No real wiki/skills catalog adapter exists yet; this build never reads local files. See docs/decisions/0006-catalog-context-picker.md.",
          );
    if (path === "/api/history" && req.method === "GET") {
      const query = z
        .object({
          key: keySchema,
          offset: z.coerce.number().int().min(0).max(1000000).default(0),
          limit: z.coerce.number().int().min(1).max(50).default(50),
        })
        .strict()
        .parse(Object.fromEntries(url.searchParams));
      selected(query.key);
      const generation = session.selectionGeneration;
      const page =
        mode === "demo"
          ? demoHistory(store, query.key, query.offset, query.limit)
          : await gateway.history(query.key, query.offset, query.limit);
      if (
        session.selected !== query.key ||
        generation !== session.selectionGeneration
      )
        throw new HttpError(409, "Selection changed while history was loading");
      if (
        new Set(page.messages.map((m) => m.id)).size !== page.messages.length ||
        page.messages.some(
          (m) =>
            !m.id ||
            m.id !== m.source.messageId ||
            m.source.sessionKey !== query.key,
        )
      )
        throw new HttpError(
          409,
          "Ambiguous or mismatched source identities; nothing captured",
        );
      const identities = new Set(
        page.messages.map((m) => JSON.stringify(m.source)),
      );
      if (identities.size !== page.messages.length)
        throw new HttpError(
          409,
          "Duplicate source identities; nothing captured",
        );
      const candidateJson = JSON.stringify(page.messages);
      if (candidateJson.length > 1000000)
        throw new HttpError(409, "Source page exceeds bounded capture size");
      for (const [token, candidate] of session.pages)
        if (candidate.expires <= Date.now()) session.pages.delete(token);
      while (
        session.pages.size >= 8 ||
        [...session.pages.values()].reduce(
          (n, p) => n + p.json.length,
          candidateJson.length,
        ) > 2000000
      )
        session.pages.delete(session.pages.keys().next().value!);
      const pageToken = randomUUID();
      session.pages.set(pageToken, {
        key: query.key,
        json: candidateJson,
        expires: Date.now() + 600000,
      });
      return { ...page, pageToken };
    }
    const exportMatch = path.match(/^\/api\/projects\/([^/]+)\/export$/);
    if (exportMatch && req.method === "GET")
      return workspace.exportProject(exportMatch[1]!);
    const previewMatch = path.match(/^\/api\/stages\/([^/]+)\/preview$/);
    if (previewMatch && req.method === "GET")
      return workspace.previewStart(previewMatch[1]!);
    const snapshotMatch = path.match(/^\/api\/stages\/([^/]+)\/snapshot$/);
    if (snapshotMatch && req.method === "GET")
      return workspace.snapshot(snapshotMatch[1]!);
    if (req.method !== "POST") throw new HttpError(404, "API route not found");
    const body = await jsonBody(req);
    if (path === "/api/connect") {
      z.object({}).strict().parse(body);
      if (mode !== "live")
        throw new HttpError(409, "Demo mode cannot contact a Gateway");
      security.clearSelections();
      await gateway.connect();
      return connection();
    }
    if (path === "/api/select") {
      const { key } = z.object({ key: keySchema }).strict().parse(body);
      if (
        mode === "demo" &&
        !demoConversations.some((item) => item.key === key)
      )
        throw new HttpError(404, "Unknown conversation");
      if (mode === "live") gateway.select(key);
      session.selected = key;
      session.selectionGeneration++;
      session.pages.clear();
      return { selected: key };
    }
    if (path === "/api/chat") {
      const data = z
        .object({ key: keySchema, text: z.string().trim().min(1).max(8000) })
        .strict()
        .parse(body);
      selected(data.key);
      if (mode !== "demo")
        throw new HttpError(
          409,
          "Live channel replies are disabled in this MVP",
        );
      addDemoMessage(store, data.key, data.text);
      addDemoMessage(
        store,
        data.key,
        `Simulated assistant: received your ${data.text.length}-character note. Select its exact excerpt to curate a project. This deterministic reply is not model inference.`,
        "assistant",
      );
      return { simulated: true };
    }
    if (path === "/api/projects") {
      const data = selectionSchema
        .extend({ name: z.string().trim().min(1).max(120), lifetime })
        .strict()
        .parse(body);
      return workspace.createProject(data.name, data.lifetime, excerpts(data));
    }
    if (path === "/api/catalog/projects") {
      if (mode !== "demo")
        throw new HttpError(409, "Catalog is unavailable outside demo mode");
      const data = catalogSelectionSchema
        .extend({ name: z.string().trim().min(1).max(120), lifetime })
        .strict()
        .parse(body);
      return workspace.createProject(
        data.name,
        data.lifetime,
        resolveCatalogExcerpts(data.refs),
      );
    }
    const projectMatch = path.match(
      /^\/api\/projects\/([^/]+)(?:\/(context|catalog-context|stages))?$/,
    );
    if (projectMatch) {
      const id = projectMatch[1]!;
      if (projectMatch[2] === "context") {
        const data = selectionSchema.strict().parse(body);
        workspace.addContext(id, excerpts(data));
        return { saved: true };
      }
      if (projectMatch[2] === "catalog-context") {
        if (mode !== "demo")
          throw new HttpError(409, "Catalog is unavailable outside demo mode");
        const data = catalogSelectionSchema.strict().parse(body);
        workspace.addContext(id, resolveCatalogExcerpts(data.refs));
        return { saved: true };
      }
      if (projectMatch[2] === "stages") {
        if (mode !== "demo")
          throw new HttpError(
            409,
            "Live managed execution is unverified and disabled",
          );
        const data = z
          .object({
            title: z.string().min(1).max(120),
            briefs: z.array(brief).min(1).max(4),
          })
          .strict()
          .parse(body);
        return workspace.createStage(id, data.title, data.briefs);
      }
      return workspace.updateProject(
        id,
        z
          .object({
            lifetime: lifetime.optional(),
            status: z.enum(["active", "archived"]).optional(),
            name: z.string().trim().min(1).max(120).optional(),
          })
          .strict()
          .parse(body),
      );
    }
    const contextMatch = path.match(
      /^\/api\/projects\/([^/]+)\/context\/([^/]+)$/,
    );
    if (contextMatch) {
      const data = z
        .object({ kind, text: z.string().min(1).max(20000) })
        .strict()
        .parse(body);
      workspace.editContext(
        contextMatch[1]!,
        contextMatch[2]!,
        data.kind,
        data.text,
      );
      return { saved: true };
    }
    const stageMatch = path.match(
      /^\/api\/stages\/([^/]+)\/(start|review|revise|reconcile)$/,
    );
    if (stageMatch) {
      const id = stageMatch[1]!;
      if (!dispatcher)
        throw new HttpError(
          409,
          "Live managed execution is unverified and disabled",
        );
      if (stageMatch[2] === "reconcile") {
        const data = z
          .object({
            note: z.string().trim().min(1).max(4000),
            abandon: z.literal(true),
          })
          .strict()
          .parse(body);
        workspace.reconcileDemo(id, data.note);
        return { saved: true };
      }
      if (stageMatch[2] === "start") {
        const data = z
          .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
          .strict()
          .parse(body);
        return { tasks: dispatcher.start(id, data.token) };
      }
      if (stageMatch[2] === "review") {
        const data = z
          .object({
            revision: z.number().int().positive(),
            generation: z.number().int().nonnegative(),
            requestId: z.string().uuid(),
            action: z.enum(["approve", "changes", "reject"]),
            note: z.string().trim().min(1).max(4000),
          })
          .strict()
          .parse(body);
        workspace.review(
          id,
          data.revision,
          data.action,
          data.note,
          data.generation,
          data.requestId,
        );
        return { saved: true };
      }
      const data = z
        .object({
          revision: z.number().int().positive(),
          generation: z.number().int().nonnegative(),
          proposal: z.string().min(1).max(20000),
          assumptions: z.string().max(20000),
          missing: z.string().max(20000),
          alternatives: z.string().max(20000),
        })
        .strict()
        .parse(body);
      workspace.reviseStage(
        id,
        data.proposal,
        data.assumptions,
        data.missing,
        data.alternatives,
        { revision: data.revision, generation: data.generation },
      );
      return { saved: true };
    }
    throw new HttpError(404, "API route not found");
  }
  function handler(req: IncomingMessage, res: ServerResponse) {
    void route(req, res)
      .then((data) => {
        if (!res.writableEnded) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        }
      })
      .catch((error: unknown) => {
        if (res.writableEnded) return;
        res.statusCode =
          error instanceof HttpError
            ? error.status
            : error instanceof ZodError
              ? 400
              : 409;
        // Never echo request payloads, upstream errors or validation values.
        const message =
          error instanceof HttpError
            ? error.message
            : error instanceof ZodError
              ? "Invalid request fields or bounds"
              : error instanceof Error && !error.message.includes("SQL")
                ? error.message
                : "Operation could not be completed";
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: message }));
      });
  }
  return {
    handler,
    close: () => {
      dispatcher?.close();
      gateway.close();
    },
  };
}
