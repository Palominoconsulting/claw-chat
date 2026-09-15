import {
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { Store } from "../server/store.js";
const dirs: string[] = [];
afterEach(() =>
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })),
);
function location() {
  const dir = mkdtempSync(".data-lock-test-");
  dirs.push(dir);
  return join(dir, "test.sqlite");
}
it("second owner fails before opening, chmod or migrating the database", () => {
  const path = location();
  writeFileSync(path, "synthetic untouched bytes");
  writeFileSync(`${path}.lock`, "other owner");
  const mode = statSync(path).mode;
  expect(() => new Store(path, "demo")).toThrow(/owner lock/);
  expect(readFileSync(path, "utf8")).toBe("synthetic untouched bytes");
  expect(statSync(path).mode).toBe(mode);
  expect(readFileSync(`${path}.lock`, "utf8")).toBe("other owner");
});
it("failed initialization closes its database and releases only its own lock", () => {
  const path = location();
  writeFileSync(path, "not SQLite");
  expect(() => new Store(path, "demo")).toThrow();
  expect(existsSync(`${path}.lock`)).toBe(false);
});
it("a real second Store cannot mutate the owner's schema; normal close releases the lock", () => {
  const path = location();
  const owner = new Store(path, "demo");
  owner.db.exec("PRAGMA user_version=1");
  const before = readFileSync(path);
  expect(() => new Store(path, "demo")).toThrow(/owner lock/);
  expect(owner.db.prepare("PRAGMA user_version").get()?.user_version).toBe(1);
  expect(readFileSync(path)).toEqual(before);
  owner.close();
  expect(existsSync(`${path}.lock`)).toBe(false);
});

it("invalid origin never opens a database or strands ownership", async () => {
  const { startLocal } = await import("../server/startup.js");
  const path = location();
  await expect(
    startLocal({
      path,
      mode: "demo",
      origin: "http://foreign.invalid/path",
      port: 0,
    }),
  ).rejects.toThrow(/origin|APP_ORIGIN/);
  expect(existsSync(path)).toBe(false);
  expect(existsSync(`${path}.lock`)).toBe(false);
});
it("failed listener initialization releases ownership without taking over another service", async () => {
  const { startLocal } = await import("../server/startup.js");
  const { createServer } = await import("node:http");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture socket");
  const path = location();
  try {
    await expect(
      startLocal({
        path,
        mode: "demo",
        origin: `http://127.0.0.1:${address.port}`,
        port: address.port,
      }),
    ).rejects.toThrow();
    expect(existsSync(`${path}.lock`)).toBe(false);
    expect(server.listening).toBe(true);
    const reopened = new Store(path, "demo");
    reopened.close();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
