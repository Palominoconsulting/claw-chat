import { useEffect, useLayoutEffect, useReducer, useState } from "react";
import type { Task, WorkspaceState } from "../../shared/types.js";
import {
  LobsterAudio,
  SOUND_PREFERENCE,
  SoundPolicy,
  readSoundPreference,
} from "./lobsterSounds.js";
import type { SoundCue, SoundPreference } from "./lobsterSounds.js";

export function useLobsterSounds(blocked: boolean) {
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  const [sounds] = useState(() => {
    const audio = new LobsterAudio(readSoundPreference());
    const policy = new SoundPolicy();
    let testId = 0;
    let cycle = 0;
    let latest: WorkspaceState | null = null;
    let latestAllowed = false;
    function emit(id: string, cue: SoundCue, allowed = true) {
      const selected = policy.take(
        id,
        cue,
        performance.now(),
        allowed && audio.ready && !document.hidden,
      );
      if (selected) audio.play(selected);
    }
    return {
      audio,
      configure(preference: SoundPreference) {
        audio.configure(preference);
        if (!preference.enabled || preference.volume === 0) {
          cycle++;
          policy.cancelPending();
        }
        try {
          localStorage.setItem(
            SOUND_PREFERENCE,
            JSON.stringify(audio.preference),
          );
        } catch {
          /* Optional preference only. */
        }
      },
      async testFromGesture() {
        if (await audio.unlockFromGesture())
          emit(`test:${++testId}`, "completed");
      },
      action() {
        // Launch is deliberately confirmed on a quiet review screen; activation
        // must predate the action, but its cue waits until that review closes.
        const began = audio.activated && !document.hidden ? cycle : null;
        return {
          saved(id: string) {
            if (began === cycle) emit(`save:${id}`, "saved");
          },
          started(tasks: Task[]) {
            if (began !== cycle) return;
            if (audio.ready && !document.hidden) policy.started(tasks);
            if (tasks[0]) emit(`start:${tasks[0].stageId}`, "started");
            // The confirmation refresh may already contain terminal results.
            // Consume them now, never during a later unrelated refresh.
            if (latest)
              for (const id of policy.observe(latest))
                emit(`complete:${id}`, "completed", latestAllowed);
          },
        };
      },
      observe(next: WorkspaceState, allowed: boolean) {
        latest = next;
        latestAllowed = allowed;
        for (const id of policy.observe(next))
          emit(`complete:${id}`, "completed", allowed);
      },
      hide(hidden: boolean) {
        if (hidden) {
          cycle++;
          policy.cancelPending();
        }
        audio.setHidden(hidden);
      },
      syncPreference() {
        cycle++;
        policy.cancelPending();
        // A preference changed by another tab never grants gesture authorization.
        audio.configure({ enabled: false, volume: 35 });
        audio.configure(readSoundPreference());
      },
    };
  });
  useEffect(() => {
    sounds.audio.onChange = () => render();
    const visibility = () => sounds.hide(document.hidden);
    const hide = () => sounds.hide(true);
    const storage = (event: StorageEvent) => {
      if (event.key === SOUND_PREFERENCE || event.key === null)
        sounds.syncPreference();
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    window.addEventListener("storage", storage);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
      window.removeEventListener("storage", storage);
      sounds.audio.onChange = () => {};
      sounds.audio.dispose();
    };
  }, [sounds]);
  useLayoutEffect(() => {
    sounds.audio.setBlocked(blocked);
  }, [sounds, blocked]);
  return sounds;
}
export type LobsterSounds = ReturnType<typeof useLobsterSounds>;
