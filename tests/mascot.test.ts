import { expect, it } from "vitest";
import { MascotClock, COOLDOWN } from "../src/lib/mascot.js";
it("requires twenty minutes of active foreground time, with no catch-up burst", () => {
  const clock = new MascotClock({ enabled: true, activeMs: 0, lastShown: 0 });
  expect(clock.tick(0, { active: true, visible: true, blocked: false })).toBe(
    false,
  );
  expect(
    clock.tick(COOLDOWN, { active: true, visible: true, blocked: false }),
  ).toBe(false);
  expect(clock.state.activeMs).toBe(0);
});
it("pauses hidden or idle time and suppresses approval/error moments", () => {
  const clock = new MascotClock({
    enabled: true,
    activeMs: COOLDOWN,
    lastShown: 0,
  });
  expect(
    clock.tick(COOLDOWN + 1, { active: false, visible: true, blocked: false }),
  ).toBe(false);
  expect(
    clock.tick(COOLDOWN + 2, { active: true, visible: false, blocked: false }),
  ).toBe(false);
  expect(
    clock.tick(COOLDOWN + 3, { active: true, visible: true, blocked: true }),
  ).toBe(false);
  expect(
    clock.tick(COOLDOWN + 4, { active: true, visible: true, blocked: false }),
  ).toBe(true);
});
it("shares cooldown with milestones and restores across reconnects", () => {
  const clock = new MascotClock({
    enabled: true,
    activeMs: COOLDOWN,
    lastShown: 0,
  });
  expect(
    clock.tick(COOLDOWN + 1, { active: true, visible: true, blocked: false }),
  ).toBe(true);
  const restored = new MascotClock(clock.state);
  expect(
    restored.tick(COOLDOWN + 2, {
      active: true,
      visible: true,
      blocked: false,
    }),
  ).toBe(false);
});
it("off persists and dismissal does not trigger another opportunity", () => {
  const clock = new MascotClock({
    enabled: false,
    activeMs: COOLDOWN,
    lastShown: 0,
  });
  expect(
    clock.tick(COOLDOWN + 1, { active: true, visible: true, blocked: false }),
  ).toBe(false);
  clock.state.enabled = true;
  expect(
    clock.tick(COOLDOWN + 2, { active: true, visible: true, blocked: false }),
  ).toBe(true);
  expect(
    clock.tick(COOLDOWN + 3, { active: true, visible: true, blocked: false }),
  ).toBe(false);
});
