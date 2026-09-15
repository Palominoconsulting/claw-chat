import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  chmodSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
  statSync,
  fstatSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { Mode } from "../shared/types.js";
import { assertNoCredentials } from "./contentSafety.js";
export type Table =
  | "projects"
  | "context_items"
  | "snapshots"
  | "stages"
  | "tasks"
  | "events"
  | "messages";
export class Store {
  readonly db: DatabaseSync;
  private releaseLock?: () => void;
  private closed = false;
  constructor(path: string, mode: Mode) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      // Canonical parent prevents competing aliases from claiming separate lock paths.
      path = existsSync(path)
        ? realpathSync(path)
        : resolve(realpathSync(dirname(path)), path.split(/[\\/]/).pop()!);
      const lock = `${path}.lock`;
      let fd: number;
      try {
        fd = openSync(lock, "wx", 0o600);
      } catch {
        throw new Error(
          "Database has an owner lock. Verify its process is stopped before manually removing a crash-left lock.",
        );
      }
      const identity = fstatSync(fd);
      this.releaseLock = () => {
        try {
          const current = statSync(lock);
          if (current.ino === identity.ino && current.dev === identity.dev)
            unlinkSync(lock);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        } finally {
          closeSync(fd);
        }
      };
    }
    let opened: DatabaseSync | undefined;
    try {
      this.db = opened = new DatabaseSync(path);
      if (path !== ":memory:") chmodSync(path, 0o600);
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;");
      const version = this.db.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      if (version.user_version > 4) {
        throw new Error("Database schema is newer than this app");
      }
      if (version.user_version > 0) {
        const existing = this.db
          .prepare("SELECT value FROM metadata WHERE key=?")
          .get("mode") as { value: string } | undefined;
        if (existing && existing.value !== mode) {
          throw new Error(
            "Demo/live store mismatch: choose a separate database",
          );
        }
      }
      this.transaction(() => {
        if (version.user_version === 0)
          this.db.exec(
            readFileSync(resolve("server/schema/001-initial.sql"), "utf8"),
          );
        if (version.user_version < 2)
          this.db.exec(
            readFileSync(
              resolve("server/schema/002-original-excerpts.sql"),
              "utf8",
            ),
          );
        if (version.user_version < 3)
          this.db.exec(
            readFileSync(
              resolve("server/schema/003-immutable-ledger.sql"),
              "utf8",
            ),
          );
        if (version.user_version < 4)
          this.db.exec(
            readFileSync(
              resolve("server/schema/004-authority-bindings.sql"),
              "utf8",
            ),
          );
        this.db
          .prepare("INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)")
          .run("mode", mode);
      });
    } catch (error) {
      try {
        opened?.close();
      } finally {
        this.releaseLock?.();
        this.releaseLock = undefined;
      }
      throw error;
    }
  }
  all<T>(
    table: Table,
    filter?: {
      column: "project_id" | "stage_id" | "session_key";
      value: string;
    },
  ): T[] {
    const sql = `SELECT data FROM ${table}${filter ? ` WHERE ${filter.column}=?` : ""} ORDER BY rowid`;
    const rows = filter
      ? this.db.prepare(sql).all(filter.value)
      : this.db.prepare(sql).all();
    return rows.map((row) => JSON.parse(row.data as string) as T);
  }
  get<T>(table: Table, id: string): T {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    if (!row) throw new Error("Record not found");
    return JSON.parse(row.data as string) as T;
  }
  put<T extends { id: string }>(
    table: Table,
    data: T,
    refs: Record<string, string | number> = {},
  ) {
    assertNoCredentials(data);
    const columns = ["id", "data", ...Object.keys(refs)];
    this.db
      .prepare(
        `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(data.id, JSON.stringify(data), ...Object.values(refs));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.db.close();
    } finally {
      this.releaseLock?.();
      this.releaseLock = undefined;
    }
  }
}
