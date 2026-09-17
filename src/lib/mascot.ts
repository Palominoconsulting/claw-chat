export const COOLDOWN = 20 * 60 * 1000;
export interface MascotState {
  enabled: boolean;
  activeMs: number;
  lastShown: number;
}
export class MascotClock {
  private lastTick: number | null = null;
  constructor(readonly state: MascotState) {}
  tick(
    now: number,
    activity: { active: boolean; visible: boolean; blocked: boolean },
  ) {
    const elapsed = this.lastTick === null ? 0 : now - this.lastTick;
    this.lastTick = now;
    if (
      !this.state.enabled ||
      !activity.active ||
      !activity.visible ||
      activity.blocked
    )
      return false;
    if (elapsed > 0 && elapsed <= 5000) this.state.activeMs += elapsed;
    if (this.state.activeMs < COOLDOWN || now - this.state.lastShown < COOLDOWN)
      return false;
    this.state.activeMs = 0;
    this.state.lastShown = now;
    return true;
  }
}
