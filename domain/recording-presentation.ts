// ---------------------------------------------------------------------------
// Recording-controls presentation (SPIKE-004).
//
// One user-facing choice decides which automatic surface owns the recording
// controls:
//
//   top-bar = the top bar's reserved slot (capture draws it);
//   hover   = the capture tool's own bar, revealed on pointer entry;
//   always  = the capture tool's own bar, always visible.
//
// This module is PURE: no ags, no gi://*, no I/O. It is the single place that
// maps the setting to the two surfaces, and migrates the old
// `bar.recording_hud` vocabulary.
// ---------------------------------------------------------------------------

export type RecordingControlsMode = "top-bar" | "hover" | "always"

/** The capture tool's own S4 bar visibility, after the mode is resolved. */
export type CaptureBarMode = "hidden" | "always" | "hover"

export const DEFAULT_RECORDING_CONTROLS: RecordingControlsMode = "top-bar"

export const RECORDING_CONTROLS_MODES: readonly RecordingControlsMode[] = [
  "top-bar",
  "hover",
  "always",
]

export interface RecordingSurfaces {
  /** Whether the top bar's recording slot is active. */
  readonly topBar: boolean
  /** How the capture tool's own S4 bar behaves. */
  readonly captureBar: CaptureBarMode
  /** Whether a launcher/keybind may present the capture S4 HUD. */
  readonly allowLauncherHud: boolean
}

export function isRecordingControlsMode(
  value: unknown,
): value is RecordingControlsMode {
  return (
    value === "top-bar" || value === "hover" || value === "always"
  )
}

/**
 * Resolve the automatic surfaces for a mode.
 *
 * The invariant is deliberately total: exactly one automatic surface per mode.
 * A launcher may not add a second HUD in any of them; if a manual override is
 * wanted later it must be an explicit decision, not a default.
 */
export function recordingSurfaces(
  mode: RecordingControlsMode,
): RecordingSurfaces {
  switch (mode) {
    case "top-bar":
      return { topBar: true, captureBar: "hidden", allowLauncherHud: false }
    case "hover":
      return { topBar: false, captureBar: "hover", allowLauncherHud: false }
    case "always":
      return { topBar: false, captureBar: "always", allowLauncherHud: false }
  }
}

/**
 * Migrate the old `bar.recording_hud` value.
 *
 * `hidden` meant "no automatic capture HUD; the top bar showed the controls
 * anyway", so it maps to `top-bar`. `always`/`hover` keep their capture-bar
 * behavior and now stop the top bar from adding a second surface.
 */
export function migrateRecordingHud(value: unknown): RecordingControlsMode {
  if (value === "hidden") return "top-bar"
  if (value === "always") return "always"
  if (value === "hover") return "hover"
  return DEFAULT_RECORDING_CONTROLS
}

/**
 * Resolve a config object that may carry the new and/or legacy key.
 * The new key wins; otherwise the legacy key migrates; otherwise the default.
 */
export function resolveRecordingControls(
  value: unknown,
  legacyValue?: unknown,
): RecordingControlsMode {
  if (isRecordingControlsMode(value)) return value
  return migrateRecordingHud(legacyValue)
}
