import { describe, expect, it, vi } from "vitest";
import {
  LobsterAudio,
  SoundPolicy,
  clampVolume,
  recipes,
} from "../src/lib/lobsterSounds.js";
import type { Task, WorkspaceState } from "../shared/types.js";

function audioFixture() {
  const param = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    value: 0,
  });
  const nodes: {
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const gains: ReturnType<typeof param>[] = [];
  const context = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    onstatechange: null as (() => void) | null,
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
    createGain: vi.fn(() => {
      const gain = param();
      gains.push(gain);
      return { gain, connect: vi.fn(), disconnect: vi.fn() };
    }),
    createBiquadFilter: vi.fn(() => ({
      type: "",
      frequency: param(),
      Q: param(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => {
      const node = {
        type: "",
        frequency: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      nodes.push(node);
      return node;
    }),
  };
  const create = vi.fn(() => context as unknown as AudioContext);
  const audio = new LobsterAudio({ enabled: true, volume: 35 }, create);
  return { audio, context, create, nodes, gains };
}
const task = (id: string, status: Task["status"] = "running") =>
  ({ id, stageId: "stage", status }) as Task;
const state = (tasks: Task[]) =>
  ({
    connection: { mode: "demo" },
    tasks,
    stages: [
      {
        id: "stage",
        status: "review",
        dependencyStale: false,
        contextVersion: 1,
        projectId: "project",
      },
    ],
    projects: [{ id: "project", status: "active", contextVersion: 1 }],
  }) as WorkspaceState;

describe("original sound recipes", () => {
  it("bounds duration, non-overlapping voices and envelope gain", () => {
    for (const tones of Object.values(recipes)) {
      expect(tones.length).toBeLessThanOrEqual(6);
      tones.forEach((tone, index) => {
        expect(tone.at + tone.duration).toBeLessThan(0.8);
        expect(tone.level).toBeLessThanOrEqual(0.12);
        expect(tone.level).toBeGreaterThan(0);
        if (index)
          expect(tone.at).toBeGreaterThanOrEqual(
            tones[index - 1]!.at + tones[index - 1]!.duration,
          );
      });
    }
  });
  it("clamps volume and corrupt input conservatively", () => {
    expect([
      clampVolume(-1),
      clampVolume(200),
      clampVolume(NaN),
      clampVolume(Infinity),
    ]).toEqual([0, 100, 35, 35]);
  });
});
describe("audio lifecycle", () => {
  it("does not construct or resume at boot or on passive events", () => {
    const { audio, create } = audioFixture();
    expect(audio.play("saved")).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it("unlocks only explicitly and schedules a bounded recipe", async () => {
    const { audio, context, nodes } = audioFixture();
    await audio.unlockFromGesture();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.play("completed")).toBe(true);
    expect(nodes).toHaveLength(2);
    expect(audio.play("saved")).toBe(false); // no overlap
    nodes.forEach((node) => node.onended?.());
    expect(nodes.every((node) => node.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
    expect(audio.play("saved")).toBe(true);
  });
  it.each(["mute", "hidden", "dispose"])(
    "%s stops scheduled/playing nodes immediately",
    async (reason) => {
      const { audio, nodes, context } = audioFixture();
      await audio.unlockFromGesture();
      audio.play("completed");
      if (reason === "mute") audio.configure({ enabled: false, volume: 35 });
      if (reason === "hidden") audio.setHidden(true);
      if (reason === "dispose") audio.dispose();
      expect(
        nodes.every(
          (node) =>
            node.stop.mock.calls.length === 2 &&
            node.disconnect.mock.calls.length === 1,
        ),
      ).toBe(true);
      expect(audio.play("saved")).toBe(false);
      if (reason === "dispose") expect(context.close).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["mute", "hidden", "dispose"])(
    "late resume cannot play or arm after %s",
    async (reason) => {
      const { audio, context } = audioFixture();
      let resolve = () => {};
      context.resume.mockImplementation(
        () =>
          new Promise<void>((done) => {
            resolve = () => {
              context.state = "running";
              done();
            };
          }),
      );
      const pending = audio.unlockFromGesture();
      if (reason === "mute") audio.configure({ enabled: false, volume: 35 });
      if (reason === "hidden") audio.setHidden(true);
      if (reason === "dispose") audio.dispose();
      resolve();
      expect(await pending).toBe(false);
      expect(audio.play("completed")).toBe(false);
    },
  );
  it("never replays rejected passive sounds after an unlock", async () => {
    const { audio, context } = audioFixture();
    audio.play("completed");
    await audio.unlockFromGesture();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });
  it("handles missing, throwing and rejected APIs", async () => {
    const missing = new LobsterAudio(
      { enabled: true, volume: 35 },
      () => undefined,
    );
    expect(await missing.unlockFromGesture()).toBe(false);
    const { audio, context } = audioFixture();
    context.resume.mockRejectedValue(new Error("blocked"));
    expect(await audio.unlockFromGesture()).toBe(false);
    expect(audio.play("saved")).toBe(false);
    const throwing = new LobsterAudio({ enabled: true, volume: 35 }, () => {
      throw new Error("unsupported");
    });
    expect(await throwing.unlockFromGesture()).toBe(false);
  });
  it("requires another gesture after external suspension/closure", async () => {
    const { audio, context } = audioFixture();
    await audio.unlockFromGesture();
    context.state = "suspended";
    context.onstatechange?.();
    expect(audio.play("saved")).toBe(false);
    expect(context.resume).toHaveBeenCalledTimes(1);
    context.state = "closed";
    context.onstatechange?.();
    expect(audio.play("saved")).toBe(false);
  });
  it("cleans up a partially constructed voice when a node API throws", async () => {
    const { audio, context, nodes } = audioFixture();
    await audio.unlockFromGesture();
    context.createBiquadFilter.mockImplementationOnce(() => {
      throw new Error("node unavailable");
    });
    expect(audio.play("saved")).toBe(false);
    expect(nodes[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
  it("a failed master node can be retried on a fresh gesture", async () => {
    const { audio, context, create } = audioFixture();
    context.createGain.mockImplementationOnce(() => {
      throw new Error("node unavailable");
    });
    expect(await audio.unlockFromGesture()).toBe(false);
    expect(context.close).toHaveBeenCalledTimes(1);
    context.state = "suspended";
    expect(await audio.unlockFromGesture()).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(audio.play("saved")).toBe(true);
  });
  it("review suppression blocks tests and stops a playing cue", async () => {
    const { audio, context, nodes } = audioFixture();
    audio.setBlocked(true);
    expect(await audio.unlockFromGesture()).toBe(false);
    expect(context.resume).not.toHaveBeenCalled();
    audio.setBlocked(false);
    await audio.unlockFromGesture();
    audio.play("completed");
    audio.setBlocked(true);
    expect(nodes.every((node) => node.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
    expect(audio.play("completed")).toBe(false);
  });
  it("caps master gain and updates volume without autoplay", async () => {
    const { audio, gains, context } = audioFixture();
    audio.configure({ enabled: true, volume: 200 });
    await audio.unlockFromGesture();
    audio.play("saved");
    expect(gains[0]!.setValueAtTime).toHaveBeenCalledWith(0.5, 0);
    audio.configure({ enabled: true, volume: 0 });
    expect(audio.play("saved")).toBe(false);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });
});
describe("sound event policy", () => {
  it("deduplicates actual identities and consumes cooldown/suppressed events", () => {
    const policy = new SoundPolicy();
    expect(policy.take("save:a", "saved", 1000, true)).toBe("saved");
    expect(policy.take("save:b", "saved", 1001, true)).toBeNull();
    expect(policy.take("save:b", "saved", 5000, true)).toBeNull();
    expect(policy.take("save:c", "saved", 5000, false)).toBeNull();
    expect(policy.take("save:c", "saved", 8000, true)).toBeNull();
    expect(policy.take("save:d", "saved", 8000, true)).toBe("saved");
  });
  it("ignores bootstrap/history and completes only exact acknowledged current-session tasks once", () => {
    const policy = new SoundPolicy();
    expect(policy.observe(state([task("old", "completed")]))).toEqual([]);
    policy.started([task("one"), task("two")]);
    expect(policy.observe(state([task("one", "completed")]))).toEqual([]);
    expect(
      policy.observe(
        state([task("one", "completed"), task("two", "completed")]),
      ),
    ).toEqual(["stage"]);
    expect(
      policy.observe(
        state([task("one", "completed"), task("two", "completed")]),
      ),
    ).toEqual([]);
    policy.started([task("one"), task("two")]);
    expect(
      policy.observe(
        state([task("one", "completed"), task("two", "completed")]),
      ),
    ).toEqual([]);
  });
  it.each(["failed", "unknown"] as const)(
    "%s results never turn into a later celebration",
    (status) => {
      const policy = new SoundPolicy();
      policy.started([task("one")]);
      expect(policy.observe(state([task("one", status)]))).toEqual([]);
      expect(policy.observe(state([task("one", "completed")]))).toEqual([]);
    },
  );
  it("drops pending completion after hidden/mute and does not catch up", () => {
    const policy = new SoundPolicy();
    policy.started([task("one")]);
    policy.cancelPending();
    expect(policy.observe(state([task("one", "completed")]))).toEqual([]);
  });
  it("suppresses stale, archived and non-demo completion", () => {
    for (const change of ["stale", "archive", "live"]) {
      const policy = new SoundPolicy();
      policy.started([task("one")]);
      const next = state([task("one", "completed")]);
      if (change === "stale") next.stages[0]!.dependencyStale = true;
      if (change === "archive") next.projects[0]!.status = "archived";
      if (change === "live") next.connection.mode = "live";
      expect(policy.observe(next)).toEqual([]);
    }
  });
});
