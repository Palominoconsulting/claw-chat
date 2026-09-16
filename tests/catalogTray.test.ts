import { describe, expect, it } from "vitest";
import {
  addToTray,
  removeFromTray,
  trayItemKey
  
} from "../src/lib/catalogTray.js";
import type {TrayItem} from "../src/lib/catalogTray.js";
function item(key: string): TrayItem {
  return {
    key,
    label: "Fixture",
    sourceLabel: "Wiki",
    ref: { kind: "wiki", pageId: key },
  };
}
describe("catalog tray", () => {
  it("builds a stable, source-scoped key", () => {
    expect(trayItemKey("wiki:demo-page", "demo-page")).toBe(
      "wiki:demo-page:demo-page",
    );
  });
  it("adds an item once and ignores a duplicate add", () => {
    let tray = addToTray([], item("a"));
    tray = addToTray(tray, item("a"));
    expect(tray).toHaveLength(1);
  });
  it("adds a distinct item alongside an existing one", () => {
    let tray = addToTray([], item("a"));
    tray = addToTray(tray, item("b"));
    expect(tray.map((entry) => entry.key)).toEqual(["a", "b"]);
  });
  it("removes only the matching item", () => {
    let tray = addToTray([], item("a"));
    tray = addToTray(tray, item("b"));
    tray = removeFromTray(tray, "a");
    expect(tray.map((entry) => entry.key)).toEqual(["b"]);
  });
});
