import { useEffect, useRef, useState } from "react";
import { MascotClock } from "../lib/mascot.js";
import type { MascotState } from "../lib/mascot.js";
import { Button } from "./Primitives.js";
const key = "claw-chat.mascot.v1";
function load(): MascotState {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) ?? "{}",
    ) as Partial<MascotState>;
    return {
      enabled: value.enabled !== false,
      activeMs:
        typeof value.activeMs === "number"
          ? Math.max(0, Math.min(value.activeMs, 1200000))
          : 0,
      lastShown: typeof value.lastShown === "number" ? value.lastShown : 0,
    };
  } catch {
    return { enabled: true, activeMs: 0, lastShown: 0 };
  }
}
export function Mascot({ blocked }: { blocked: boolean }) {
  const [enabled, setEnabled] = useState(() => load().enabled);
  const [visible, setVisible] = useState(false);
  const clockRef = useRef(new MascotClock(load()));
  const inputRef = useRef(0);
  useEffect(() => {
    inputRef.current = Date.now();
    const active = () => {
      inputRef.current = Date.now();
    };
    const sync = () => {
      const stored = load();
      clockRef.current.state.lastShown = stored.lastShown;
      clockRef.current.state.enabled = stored.enabled;
      setEnabled(stored.enabled);
    };
    window.addEventListener("pointerdown", active);
    window.addEventListener("keydown", active);
    window.addEventListener("storage", sync);
    const interval = setInterval(() => {
      if (
        clockRef.current.tick(Date.now(), {
          active: Date.now() - inputRef.current < 60000,
          visible: !document.hidden,
          blocked,
        })
      )
        setVisible(true);
      try {
        localStorage.setItem(key, JSON.stringify(clockRef.current.state));
      } catch {
        /* Preferences are optional when storage is unavailable. */
      }
    }, 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", active);
      window.removeEventListener("keydown", active);
      window.removeEventListener("storage", sync);
    };
  }, [blocked]);
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setVisible(false);
    clockRef.current.state.enabled = next;
    try {
      localStorage.setItem(key, JSON.stringify(clockRef.current.state));
    } catch {
      /* Private browsing can deny local storage. */
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        onPress={toggle}
        aria-pressed={enabled}
        className="mascot-toggle"
      >
        Lobster encouragement: {enabled ? "on" : "off"}
      </Button>
      {visible && enabled && !blocked && (
        <aside className="mascot" aria-label="Optional encouragement">
          <img src="/assets/lobster-avatar.webp" alt="" />
          <div>
            <strong>A word from your lobster</strong>
            <p>You’re doing great. I have claws, so I would know.</p>
            <small>Encouragement, not a check of your work.</small>
          </div>
          <Button
            variant="ghost"
            onPress={() => setVisible(false)}
            aria-label="Dismiss encouragement"
          >
            ×
          </Button>
        </aside>
      )}
    </>
  );
}
