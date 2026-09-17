/** Original MIT UI wrappers. Button uses Adobe React Aria Components (Apache-2.0).
 * No Untitled UI PRO source or paid assets are included. See THIRD_PARTY_NOTICES.md.
 */
import { Button as AriaButton } from "react-aria-components";
import type { ComponentProps, ReactNode } from "react";
export function Button({
  children,
  variant = "secondary",
  ...props
}: ComponentProps<typeof AriaButton> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <AriaButton
      {...props}
      className={`button ${variant} ${typeof props.className === "string" ? props.className : ""}`}
    >
      {children}
    </AriaButton>
  );
}
export function Tag({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <span className={`tag ${warning ? "warning" : ""}`}>
      {warning && <span aria-hidden="true">!</span>}
      {children}
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="eyebrow">A little room to think</span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Icon({
  name,
}: {
  name:
    | "chat"
    | "folder"
    | "runs"
    | "context"
    | "decision"
    | "settings"
    | "sun"
    | "moon"
    | "panel"
    | "arrow";
}) {
  const paths = {
    chat: "M5 4h14v11H9l-4 4V4Z",
    folder: "M3 6h7l2 2h9v11H3V6Z",
    runs: "M5 4v16m0-12h7m-7 8h7m0-10h7v4h-7V6Zm0 8h7v4h-7v-4Z",
    context: "M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4",
    decision: "m5 12 4 4 10-10M4 4h7M4 4v16h16v-7",
    settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z",
    panel: "M3 4h18v16H3V4Zm12 0v16",
    arrow: "M4 12h15m-6-6 6 6-6 6",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
