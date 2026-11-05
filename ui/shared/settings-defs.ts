// ---------------------------------------------------------------------------
// PURE settings-panel vocabulary (REQ-012, design.md §3.6/§4.2).
//
// No `ags/*`, no `gi://*`, no I/O. `SettingsPage` uses these titles and row
// names so the panel order has ONE definition; the mockup parity test compares
// them to the `settings` block of the design contract.
//
// `barFields` is deliberately not part of the REQ-012 group rows: REQ-014 adds
// that row. `settingsGroups({ barFields: true })` is the ready insertion point.
// ---------------------------------------------------------------------------

import type { RecordingControlsMode } from "../../domain/recording-presentation"

export const SETTINGS_GROUP_TITLES = {
  files: "Files",
  behaviour: "Behaviour",
  placement: "Placement",
  runtime: "Runtime",
} as const

export const SETTINGS_ROW_NAMES = {
  screenshotFolder: "Screenshot folder",
  recordingFolder: "Recording folder",
  filenamePattern: "Filename pattern",
  showNotifications: "Show notifications",
  compactBarIndicator: "Compact bar indicator",
  /** Reserved for REQ-014; not rendered in REQ-012. */
  barFields: "Bar fields",
  barPosition: "Bar position",
  topOffset: "Top offset",
  recordingControls: "Recording controls",
  recorderBackend: "Recorder backend",
  laneMemory: "Lane memory",
} as const

export interface SettingsGroupDef {
  title: string
  rows: readonly string[]
}

/** Group order for the cleaned-up panel: Files, Behaviour, Placement, Runtime. */
export const SETTINGS_GROUPS: readonly SettingsGroupDef[] = [
  {
    title: SETTINGS_GROUP_TITLES.files,
    rows: [
      SETTINGS_ROW_NAMES.screenshotFolder,
      SETTINGS_ROW_NAMES.recordingFolder,
      SETTINGS_ROW_NAMES.filenamePattern,
    ],
  },
  {
    title: SETTINGS_GROUP_TITLES.behaviour,
    rows: [SETTINGS_ROW_NAMES.showNotifications, SETTINGS_ROW_NAMES.compactBarIndicator],
  },
  {
    title: SETTINGS_GROUP_TITLES.placement,
    rows: [
      SETTINGS_ROW_NAMES.barPosition,
      SETTINGS_ROW_NAMES.topOffset,
      SETTINGS_ROW_NAMES.recordingControls,
    ],
  },
  {
    title: SETTINGS_GROUP_TITLES.runtime,
    rows: [SETTINGS_ROW_NAMES.recorderBackend, SETTINGS_ROW_NAMES.laneMemory],
  },
]

/**
 * Group rows for the current build. REQ-014 calls this with
 * `{ barFields: true }` to append `Bar fields` to Behaviour without a second
 * ordering table.
 */
export function settingsGroups(options: { barFields?: boolean } = {}): SettingsGroupDef[] {
  return SETTINGS_GROUPS.map((group) =>
    options.barFields === true && group.title === SETTINGS_GROUP_TITLES.behaviour
      ? { ...group, rows: [...group.rows, SETTINGS_ROW_NAMES.barFields] }
      : { title: group.title, rows: [...group.rows] },
  )
}

/** The three unified recording-controls modes (design.md §3.6). */
export const SETTINGS_RECORDING_CONTROL_OPTIONS: ReadonlyArray<{
  label: string
  value: RecordingControlsMode
}> = [
  { label: "Top bar", value: "top-bar" },
  { label: "On hover", value: "hover" },
  { label: "Always visible", value: "always" },
]
