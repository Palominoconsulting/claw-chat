import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { GatewayClient } from "@openclaw/gateway-client";
import type { DeviceAuthTokenRecord } from "@openclaw/gateway-client";
import { PROTOCOL_VERSION } from "@openclaw/gateway-protocol/version";
import { z } from "zod";
import type { Connection, Conversation, MessagePage } from "../shared/types.js";
const string = z.string().max(20000);
const sessionSchema = z.object({
  key: string,
  sessionId: string,
  label: string.optional(),
  displayName: string.optional(),
  parentSessionKey: string.optional(),
  status: string.optional(),
});
const sessionsSchema = z.object({
  sessions: z.array(sessionSchema).max(100),
  hasMore: z.boolean().optional(),
});
const messageSchema = z.object({
  id: string.optional(),
  messageId: string.optional(),
  role: string,
  content: z.union([
    string,
    z.array(z.object({ type: string, text: string.optional() })).max(100),
  ]),
  timestamp: z.union([z.string(), z.number()]).optional(),
});
const historySchema = z.object({
  sessionId: string,
  messages: z.array(messageSchema).max(50),
  hasMore: z.boolean().optional(),
  nextOffset: z.number().int().nonnegative().optional(),
});
export interface GatewayOptions {
  origin: string;
  url?: string;
  bootstrapToken?: string;
}
export class GatewayAdapter {
  private client?: GatewayClient;
  private generation = 0;
  private cancelConnect?: () => void;
  private selected = new Set<string>();
  private known: Conversation[] = [];
  private state: Connection["state"] = "not_paired";
  private detail =
    "Live not verified. Supply a server-side bootstrap secret, then request normal device pairing.";
  private deviceToken: DeviceAuthTokenRecord | null = null;
  private readonly keys = generateKeyPairSync("ed25519");
  private readonly rawPublic = this.keys.publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32);
  private readonly deviceId = createHash("sha256")
    .update(this.rawPublic)
    .digest("hex");
  constructor(private options: GatewayOptions) {}
  connection(): Connection {
    return {
      mode: "live",
      state: this.state,
      detail: this.detail,
      canExecute: false,
    };
  }
  async connect() {
    if (this.state === "connecting" || this.state === "read_only_unverified")
      return;
    if (!this.options.bootstrapToken || !this.options.url)
      throw new Error(
        "Live requires a separately supplied server-side GATEWAY_URL and GATEWAY_BOOTSTRAP_TOKEN",
      );
    const url = new URL(this.options.url);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["ws:", "wss:"].includes(url.protocol)
    )
      throw new Error(
        "Gateway URL must be credential-free ws/wss with no query or fragment",
      );
    if (
      url.protocol === "ws:" &&
      !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)
    )
      throw new Error("Plaintext Gateway connections must use loopback");
    this.close();
    const generation = this.generation;
    this.state = "connecting";
    this.detail = "Requesting normal device pairing for operator.read only.";
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.close();
        this.detail =
          "Connection timed out. Complete pairing in your Gateway and try again.";
        reject(new Error(this.detail));
      }, 10000);
      this.cancelConnect = () => {
        clearTimeout(timeout);
        reject(
          new Error(
            "Connection closed; complete pairing and explicitly reconnect.",
          ),
        );
      };
      this.client = new GatewayClient({
        url: url.toString(),
        origin: this.options.origin,
        bootstrapToken: this.options.bootstrapToken,
        preferBootstrapToken: true,
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        clientName: "gateway-client",
        clientDisplayName: "claw-chat",
        clientVersion: "0.1.0",
        platform: process.platform,
        mode: "ui",
        role: "operator",
        scopes: ["operator.read"],
        caps: [],
        requestTimeoutMs: 8000,
        deviceIdentity: {
          deviceId: this.deviceId,
          privateKeyPem: this.keys.privateKey
            .export({ type: "pkcs8", format: "pem" })
            .toString(),
          publicKeyPem: this.keys.publicKey
            .export({ type: "spki", format: "pem" })
            .toString(),
        },
        hostDeps: {
          signDevicePayload: (key, payload) =>
            sign(null, Buffer.from(payload), key).toString("base64url"),
          publicKeyRawBase64UrlFromPem: (key) =>
            createPublicKey(key)
              .export({ type: "spki", format: "der" })
              .subarray(-32)
              .toString("base64url"),
          loadDeviceAuthToken: () => this.deviceToken,
          storeDeviceAuthToken: (record) => {
            this.deviceToken = { token: record.token, scopes: record.scopes };
          },
          clearDeviceAuthToken: () => {
            this.deviceToken = null;
          },
          logDebug: () => {},
          logError: () => {},
          redactForLog: () => "[Gateway diagnostic omitted]",
        },
        onHelloOk: (hello) => {
          if (generation !== this.generation) return;
          this.cancelConnect = undefined;
          clearTimeout(timeout);
          if (
            hello.server.version !== "2026.8.1" ||
            hello.auth?.role !== "operator" ||
            !hello.auth.scopes?.includes("operator.read") ||
            hello.auth?.scopes?.some((scope) => scope !== "operator.read")
          ) {
            this.close();
            this.state = "unsupported";
            this.detail =
              "Unsupported version or scopes. Only the 2026.8.1 read-only candidate is accepted; no live pair is certified.";
            reject(new Error(this.detail));
            return;
          }
          this.state = "read_only_unverified";
          this.detail =
            "Authenticated read-only candidate. Live compatibility is not certified. Managed execution and channel replies are disabled.";
          resolve();
        },
        onConnectError: () => {
          if (generation !== this.generation) return;
          clearTimeout(timeout);
          this.close();
          this.detail =
            "Pairing or authentication was denied. Review the request in your Gateway; no settings were changed.";
          reject(new Error(this.detail));
        },
        onClose: () => {
          if (generation !== this.generation) return;
          this.selected.clear();
          this.known = [];
          if (this.state !== "unsupported") this.state = "not_paired";
          this.detail =
            "Disconnected. Select sessions again after explicit reconnect.";
          this.client?.stop();
        },
        onGap: () => {
          if (generation !== this.generation) return;
          this.selected.clear();
          this.known = [];
          this.detail =
            "Event gap detected. Refresh and explicitly reselect your conversation.";
        },
      });
      this.client.start();
    });
  }
  async list(): Promise<Conversation[]> {
    if (this.state !== "read_only_unverified" || !this.client) return [];
    try {
      const result = sessionsSchema.parse(
        await this.client.request("sessions.list", { limit: 100, offset: 0 }),
      );
      this.known = result.sessions.map((row) => ({
        key: row.key,
        sessionId: row.sessionId,
        title: row.label ?? row.displayName ?? row.key,
        parentKey: row.parentSessionKey ?? null,
        lineage: "incomplete",
        status: row.status ?? "Unknown",
      }));
      return this.known;
    } catch {
      throw new Error(
        "Session response unsupported or unavailable; no private-file fallback",
      );
    }
  }
  select(key: string) {
    if (!this.known.some((row) => row.key === key))
      throw new Error("Select a session from the authenticated index");
    this.selected.clear();
    this.selected.add(key);
  }
  async history(
    key: string,
    offset: number,
    limit: number,
  ): Promise<MessagePage> {
    if (!this.selected.has(key) || !this.client)
      throw new Error("Session has not been explicitly selected");
    try {
      const result = historySchema.parse(
        await this.client.request("chat.history", {
          sessionKey: key,
          offset,
          limit,
          maxChars: 20000,
        }),
      );
      const session = this.known.find((row) => row.key === key);
      if (result.sessionId !== session?.sessionId) {
        this.selected.clear();
        throw new Error("Session instance changed");
      }
      const gateway = createHash("sha256")
        .update(this.options.url!)
        .digest("hex");
      return {
        messages: result.messages.map((row) => {
          const id = row.id ?? row.messageId;
          if (!id) throw new Error("Stable message identity unavailable");
          const body =
            typeof row.content === "string"
              ? row.content
              : row.content
                  .map((part) =>
                    part.type === "text"
                      ? (part.text ?? "")
                      : `[${part.type} content omitted]`,
                  )
                  .join("\n");
          if (body.length > 20000)
            throw new Error("Transcript message exceeds bounded text limit");
          return {
            id,
            text: body,
            author: row.role,
            role: row.role,
            simulated: false,
            createdAt: "",
            source: {
              gateway,
              operator: this.deviceId,
              sessionKey: key,
              sessionId: result.sessionId,
              messageId: id,
            },
          };
        }),
        nextOffset:
          result.hasMore && result.nextOffset !== undefined
            ? result.nextOffset
            : null,
        incomplete: true,
      };
    } catch {
      throw new Error(
        "History unsupported, stale, or unavailable; nothing was cached. Reselect after refresh.",
      );
    }
  }
  close() {
    this.generation++;
    this.cancelConnect?.();
    this.cancelConnect = undefined;
    this.client?.stop();
    this.client = undefined;
    this.selected.clear();
    this.known = [];
    this.state = "not_paired";
  }
}
