import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Primitives.js";

/** A desktop pane, and a dismissible, keyboard-contained sheet on small screens. */
export function Inspector({
  mobile,
  focusKey,
  onClose,
  navigation,
  children,
}: {
  mobile: boolean;
  focusKey?: string;
  onClose: () => void;
  navigation?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusKey && !mobile) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.scrollTo(0, 0);
      ref.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, mobile]);
  return (
    <aside
      ref={ref}
      className="inspector"
      role={mobile ? "dialog" : "complementary"}
      aria-modal={mobile || undefined}
      aria-label="Inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (mobile && event.key === "Tab") {
          const controls = Array.from(
            ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), summary, a[href], [tabindex="0"]',
            ) ?? [],
          ).filter((element) => element.getClientRects().length);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="inspector-toolbar">
        <div className="inspector-header">
          <span>Inspector</span>
          <Button
            variant="ghost"
            aria-label="Close inspector"
            onPress={onClose}
          >
            ×
          </Button>
        </div>
        {navigation}
      </div>
      {children}
    </aside>
  );
}
