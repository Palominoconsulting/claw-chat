import type { LobsterSounds } from "../lib/useLobsterSounds.js";
import { Button } from "./Primitives.js";

export function SoundControls({ sounds }: { sounds: LobsterSounds }) {
  const { preference, status } = sounds.audio;
  return (
    <details className="sound-controls">
      <summary>
        Lobster sounds:{" "}
        {preference.enabled && preference.volume > 0 ? "on" : "off"}
      </summary>
      <div className="sound-settings" role="group" aria-label="Lobster sounds">
        <label className="check-label">
          <input
            type="checkbox"
            checked={preference.enabled}
            onChange={(event) =>
              sounds.configure({ ...preference, enabled: event.target.checked })
            }
          />
          Enable Lobster sounds
        </label>
        <label className="sound-volume">
          Volume · {preference.volume}%
          <input
            aria-label="Lobster sound volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={preference.volume}
            onChange={(event) =>
              sounds.configure({
                ...preference,
                volume: Number(event.target.value),
              })
            }
          />
        </label>
        <Button
          isDisabled={!preference.enabled || preference.volume === 0}
          onPress={() => void sounds.testFromGesture()}
        >
          Test sound
        </Button>
        <small>{status}</small>
        <p>
          Brief shell taps, a scuttle and a bubbly whoop. Off by default. After
          each reload or hidden page, use Test sound to activate. A returned
          simulation is not a checked result. No sounds for approvals.
        </p>
      </div>
    </details>
  );
}
