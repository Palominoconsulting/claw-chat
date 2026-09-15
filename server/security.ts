import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface BrowserSession {
  csrf: string;
  expires: number;
  selected: string | null;
  page: import("../shared/types.js").Message[];
}
export class Security {
  private sessions = new Map<string, BrowserSession>();
  private readonly target: URL;
  constructor(readonly origin: string) {
    this.target = new URL(origin);
    if (
      this.target.origin !== origin ||
      !["http:", "https:"].includes(this.target.protocol)
    )
      throw new Error(
        "APP_ORIGIN must be an exact HTTP(S) origin, without path or trailing slash",
      );
    if (
      this.target.protocol === "http:" &&
      !["127.0.0.1", "localhost", "[::1]"].includes(this.target.hostname)
    )
      throw new Error("Non-loopback APP_ORIGIN requires HTTPS");
  }
  headers(res: ServerResponse) {
    // Exact hash of the pinned React Aria touch-action style; no arbitrary inline styles.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
  }
  checkOrigin(req: IncomingMessage) {
    if (req.headers.host !== this.target.host)
      throw new HttpError(403, "Host not allowed");
    if (req.headers.origin !== undefined && req.headers.origin !== this.origin)
      throw new HttpError(403, "Origin not allowed");
    if (
      req.headers["sec-fetch-site"] &&
      !["same-origin", "none"].includes(String(req.headers["sec-fetch-site"]))
    )
      throw new HttpError(403, "Cross-site request denied");
  }
  private token(req: IncomingMessage) {
    return req.headers.cookie
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("claw_session="))
      ?.slice(13);
  }
  bootstrap(req: IncomingMessage, res: ServerResponse) {
    const previous = this.token(req);
    const session = previous ? this.sessions.get(previous) : undefined;
    if (session && session.expires > Date.now()) return session;
    for (const [key, value] of this.sessions)
      if (value.expires <= Date.now()) this.sessions.delete(key);
    if (this.sessions.size >= 32)
      throw new HttpError(
        429,
        "Too many browser sessions; restart the app to clear local sessions",
      );
    const token = randomBytes(32).toString("hex");
    const entry = {
      csrf: randomBytes(32).toString("hex"),
      expires: Date.now() + 12 * 3600000,
      selected: null,
      page: [],
    };
    this.sessions.set(token, entry);
    res.setHeader(
      "Set-Cookie",
      `claw_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${this.target.protocol === "https:" ? "; Secure" : ""}`,
    );
    return entry;
  }
  clearSelections() {
    this.sessions.forEach((session) => {
      session.selected = null;
      session.page = [];
    });
  }
  authorize(req: IncomingMessage) {
    const token = this.token(req);
    const session = token ? this.sessions.get(token) : undefined;
    if (!session || session.expires <= Date.now())
      throw new HttpError(401, "Browser session expired. Reload this page.");
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.headers.origin !== this.origin)
        throw new HttpError(403, "Explicit same Origin required");
      if (req.headers["content-type"] !== "application/json")
        throw new HttpError(415, "Use application/json");
      const candidate = req.headers["x-csrf-token"];
      if (
        typeof candidate !== "string" ||
        candidate.length !== session.csrf.length ||
        !timingSafeEqual(Buffer.from(candidate), Buffer.from(session.csrf))
      )
        throw new HttpError(403, "CSRF token missing or invalid");
    }
    return session;
  }
}
export async function jsonBody(req: IncomingMessage): Promise<unknown> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const data = Buffer.from(chunk as Uint8Array);
    bytes += data.length;
    if (bytes > 128000) throw new HttpError(413, "Request exceeds 128 KB");
    chunks.push(data);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
