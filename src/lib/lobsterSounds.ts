import type { Task, WorkspaceState } from "../../shared/types.js";

export const SOUND_PREFERENCE = "claw-chat.sounds.v1";
export const SOUND_COOLDOWN_MS = 1200;
export interface SoundPreference {
  enabled: boolean;
  volume: number;
}
export type SoundCue = "saved" | "started" | "completed";
interface Tone {
  at: number;
  duration: number;
  from: number;
  to: number;
  end: number;
  level: number;
  type: OscillatorType;
}
// Original synthesis, not samples: soft shell taps, a scuttle and a wet double whoop.
// Sequential voices keep the theoretical peak below .06 at maximum master volume.
export const recipes: Record<SoundCue, readonly Tone[]> = {
  saved: [
    {
      at: 0,
      duration: 0.065,
      from: 740,
      to: 960,
      end: 680,
      level: 0.08,
      type: "sine",
    },
    {
      at: 0.1,
      duration: 0.085,
      from: 940,
      to: 1100,
      end: 820,
      level: 0.07,
      type: "sine",
    },
  ],
  started: [
    {
      at: 0,
      duration: 0.04,
      from: 420,
      to: 780,
      end: 320,
      level: 0.08,
      type: "triangle",
    },
    {
      at: 0.055,
      duration: 0.04,
      from: 540,
      to: 920,
      end: 410,
      level: 0.07,
      type: "triangle",
    },
    {
      at: 0.11,
      duration: 0.04,
      from: 460,
      to: 810,
      end: 330,
      level: 0.08,
      type: "triangle",
    },
    {
      at: 0.165,
      duration: 0.055,
      from: 640,
      to: 1100,
      end: 460,
      level: 0.06,
      type: "triangle",
    },
  ],
  completed: [
    {
      at: 0,
      duration: 0.24,
      from: 240,
      to: 680,
      end: 300,
      level: 0.12,
      type: "sine",
    },
    {
      at: 0.29,
      duration: 0.29,
      from: 300,
      to: 820,
      end: 220,
      level: 0.1,
      type: "sine",
    },
  ],
};
export function clampVolume(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 35;
}
export function readSoundPreference(): SoundPreference {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(SOUND_PREFERENCE) ?? "null",
    );
    if (
      value &&
      typeof value === "object" &&
      "enabled" in value &&
      "volume" in value
    )
      return {
        enabled: value.enabled === true,
        volume:
          typeof value.volume === "number" ? clampVolume(value.volume) : 35,
      };
  } catch {
    /* Storage is optional. Never fail the workspace. */
  }
  return { enabled: false, volume: 35 };
}

/** A bounded, memory-only observer. Dropped events are never queued for later. */
export class SoundPolicy {
  private seen = new Set<string>();
  private starts = new Set<string>();
  private pending = new Map<string, string[]>();
  private last = -Infinity;
  take(
    id: string,
    cue: SoundCue,
    now: number,
    allowed: boolean,
  ): SoundCue | null {
    if (this.seen.has(id) || this.seen.size >= 4096) return null;
    this.seen.add(id);
    if (!allowed || now - this.last < SOUND_COOLDOWN_MS) return null;
    this.last = now;
    return cue;
  }
  started(tasks: Task[]) {
    const stageId = tasks[0]?.stageId;
    if (
      !stageId ||
      tasks.length > 4 ||
      tasks.some(
        (task) => task.stageId !== stageId || task.status !== "running",
      ) ||
      this.starts.has(stageId) ||
      this.starts.size >= 1024
    )
      return;
    this.starts.add(stageId);
    this.pending.set(
      stageId,
      tasks.map((task) => task.id),
    );
  }
  cancelPending() {
    this.pending.clear();
  }
  observe(state: WorkspaceState): string[] {
    const completed: string[] = [];
    for (const [id, ids] of this.pending) {
      const stage = state.stages.find((item) => item.id === id);
      const project = state.projects.find(
        (item) => item.id === stage?.projectId,
      );
      const tasks = ids.map((taskId) =>
        state.tasks.find((item) => item.id === taskId && item.stageId === id),
      );
      if (
        state.connection.mode !== "demo" ||
        !stage ||
        !project ||
        project.status !== "active" ||
        stage.dependencyStale ||
        stage.contextVersion !== project.contextVersion ||
        ["unknown", "rejected", "changes"].includes(stage.status) ||
        tasks.some(
          (task) => task && ["failed", "unknown"].includes(task.status),
        )
      ) {
        this.pending.delete(id);
      } else if (tasks.every((task) => task?.status === "completed")) {
        this.pending.delete(id);
        // 'review' is the returned stage state, NOT the screen or a verified result.
        if (stage.status === "review") completed.push(id);
      }
    }
    return completed;
  }
}

/** Only unlockFromGesture may construct/resume audio; play never waits or resumes. */
export class LobsterAudio {
  preference: SoundPreference;
  onChange = () => {};
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Map<OscillatorNode, () => void>();
  private armed = false;
  private hidden = false;
  private blocked = false;
  private disposed = false;
  private generation = 0;
  private unavailable = false;
  constructor(
    preference: SoundPreference,
    private create: () => AudioContext | undefined = () =>
      typeof window.AudioContext === "function"
        ? new window.AudioContext()
        : undefined,
  ) {
    this.preference = {
      enabled: preference.enabled === true,
      volume: clampVolume(preference.volume),
    };
  }
  get activated() {
    return (
      this.preference.enabled &&
      this.preference.volume > 0 &&
      this.armed &&
      !this.hidden &&
      !this.disposed &&
      this.context?.state === "running"
    );
  }
  get ready() {
    return this.activated && !this.blocked;
  }
  get status() {
    if (!this.preference.enabled || this.preference.volume === 0)
      return "Muted";
    if (this.unavailable) return "Audio unavailable. You can try again.";
    if (this.blocked) return "Quiet during review or errors";
    if (this.ready) return "Ready · decorative cues only";
    return "Use Test sound to activate for this visit";
  }
  configure(preference: SoundPreference) {
    this.preference = {
      enabled: preference.enabled === true,
      volume: clampVolume(preference.volume),
    };
    if (!this.preference.enabled || this.preference.volume === 0) {
      this.armed = false;
      this.stop();
    }
    try {
      this.master?.gain.setValueAtTime(
        this.preference.volume / 200,
        this.context?.currentTime ?? 0,
      );
    } catch {
      this.fail();
    }
    this.onChange();
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.armed = false;
      this.stop();
    }
    this.onChange();
  }
  setBlocked(blocked: boolean) {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    if (blocked) this.stop();
    this.onChange();
  }
  async unlockFromGesture(): Promise<boolean> {
    if (
      !this.preference.enabled ||
      this.preference.volume === 0 ||
      this.hidden ||
      this.blocked ||
      this.disposed
    )
      return false;
    const generation = ++this.generation;
    const began = performance.now();
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.create();
        if (!this.context) {
          this.fail();
          return false;
        }
        this.master = this.context.createGain();
        this.master.gain.setValueAtTime(
          this.preference.volume / 200,
          this.context.currentTime,
        );
        this.master.connect(this.context.destination);
        this.context.onstatechange = () => {
          if (this.context?.state !== "running") {
            this.armed = false;
            this.stop();
          }
          this.onChange();
        };
      }
      if (this.context.state !== "running") await this.context.resume();
      if (
        generation !== this.generation ||
        performance.now() - began > 1000 ||
        this.hidden ||
        this.blocked ||
        this.disposed ||
        !this.preference.enabled
      )
        return false;
      this.armed = this.context.state === "running";
      this.unavailable = !this.armed;
      this.onChange();
      return this.ready;
    } catch {
      if (generation === this.generation) this.fail();
      return false;
    }
  }
  play(cue: SoundCue): boolean {
    if (!this.ready || !this.context || !this.master || this.voices.size)
      return false;
    const context = this.context;
    try {
      for (const tone of recipes[cue]) {
        const oscillator = context.createOscillator();
        const nodes: AudioNode[] = [oscillator];
        const cleanup = () => {
          oscillator.onended = null;
          for (const node of nodes) {
            try {
              node.disconnect();
            } catch {
              /* Already closed. */
            }
          }
          this.voices.delete(oscillator);
        };
        this.voices.set(oscillator, cleanup);
        const gain = context.createGain();
        nodes.push(gain);
        const filter = context.createBiquadFilter();
        nodes.push(filter);
        oscillator.onended = cleanup;
        oscillator.type = tone.type;
        const start = context.currentTime + tone.at;
        oscillator.frequency.setValueAtTime(tone.from, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          tone.to,
          start + tone.duration * 0.42,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          tone.end,
          start + tone.duration,
        );
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, start);
        filter.Q.setValueAtTime(0.5, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(tone.level, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + tone.duration - 0.006,
        );
        gain.gain.linearRampToValueAtTime(0, start + tone.duration);
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + tone.duration);
      }
      return true;
    } catch {
      this.fail();
      return false;
    }
  }
  private fail() {
    this.unavailable = true;
    this.armed = false;
    this.stop();
    this.releaseContext();
    this.onChange();
  }
  stop() {
    this.generation++;
    for (const [oscillator, cleanup] of this.voices) {
      try {
        oscillator.stop();
      } catch {
        /* Ended or unavailable. */
      }
      cleanup();
    }
  }
  dispose() {
    this.disposed = true;
    this.armed = false;
    this.stop();
    this.releaseContext();
  }
  private releaseContext() {
    if (this.context) {
      this.context.onstatechange = null;
      try {
        this.master?.disconnect();
        void this.context.close().catch(() => {});
      } catch {
        /* Unsupported/closed audio is harmless. */
      }
    }
    this.context = undefined;
    this.master = undefined;
  }
}
