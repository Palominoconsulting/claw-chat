import type { CatalogRef } from "../../shared/types.js";
/** One item currently sitting in the "Context for this chat" tray.
 * Never executed, never given any permission. Holds only a reference; the
 * server resolves the actual text from its own authoritative catalog fixture
 * when the tray is saved (see server/catalog.ts resolveCatalogExcerpts).
 */
export interface TrayItem {
  /** Stable within a session; used for list keys and dedupe, not a server id. */
  key: string;
  label: string;
  sourceLabel: string;
  ref: CatalogRef;
}
export function trayItemKey(sessionKey: string, messageId: string): string {
  return `${sessionKey}:${messageId}`;
}
export function addToTray(tray: TrayItem[], item: TrayItem): TrayItem[] {
  if (tray.some((existing) => existing.key === item.key)) return tray;
  return [...tray, item];
}
export function removeFromTray(tray: TrayItem[], key: string): TrayItem[] {
  return tray.filter((item) => item.key !== key);
}
