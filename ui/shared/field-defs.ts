// ---------------------------------------------------------------------------
// Pure field vocabulary for the capture bar (EPIC-002 §4.2, REQ-009).
//
// This module is the TypeScript mirror of the mockup's
// `<script type="application/json" id="design-contract">` block:
//
//   tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
//
// It must stay pure: no `ags/*`, no `gi://*`, no I/O. REQ-013's parity test
// compares it to the contract, and `field-defs` is what the screenshot lane
// renders, so a label/description/option/default drift is a test failure rather
// than a review opinion.
//
// The contract's `defaults` are the mockup's display defaults. The runtime's
// first-run code defaults still come from `domain/ui-state.ts`; do not seed a
// lane from this object.
// ---------------------------------------------------------------------------

import type { CaptureTarget, ScreenshotFormat } from "../../types"

export const DESIGN_CONTRACT_VERSION = 1

/** One contract option tuple: `[value, label, description, icon]`. */
export interface FieldOptionDef {
  readonly value: string
  readonly label: string
  readonly description: string
  /** Contract icon id (for example `i-region`); the UI maps it to a glyph. */
  readonly icon: string
}

export interface FieldDef {
  readonly key: string
  readonly description: string
  readonly options: readonly FieldOptionDef[]
}

/** The Monitor field is dynamic: its rows come from the monitor catalog. */
export interface MonitorFieldDef {
  readonly key: string
  readonly description: string
  readonly source: "monitors"
}

export interface ScreenshotFieldDefs {
  readonly target: FieldDef
  readonly monitor: MonitorFieldDef
  readonly delay: FieldDef
  readonly format: FieldDef
  readonly output: FieldDef
  readonly cursor: FieldDef
}

/** Contract field order for the screenshot lane. */
export const SCREENSHOT_FIELD_ORDER = [
  "target",
  "monitor",
  "delay",
  "format",
  "output",
  "cursor",
] as const

/**
 * Contract defaults for the screenshot lane (mockup `lanes.shot.defaults`).
 * Display defaults only; `domain/ui-state.ts` owns the runtime first-run state.
 */
export const SCREENSHOT_DEFAULTS = {
  target: "Region",
  monitor: "eDP-1",
  delay: "None",
  format: "PNG",
  output: "Clipboard",
  cursor: "On",
} as const

const TARGET: FieldDef = {
  key: "Target",
  description: "What gets captured",
  options: [
    { value: "Region", label: "Region", description: "Draw a rectangle", icon: "i-region" },
    { value: "Screen", label: "Screen", description: "Whole monitor", icon: "i-screen" },
    { value: "Window", label: "Window", description: "Pick a window", icon: "i-window" },
  ],
}

const MONITOR: MonitorFieldDef = {
  key: "Monitor",
  description: "Which connected screen",
  source: "monitors",
}

const DELAY: FieldDef = {
  key: "Delay",
  description: "Wait before the shutter",
  options: [
    { value: "None", label: "None", description: "Capture immediately", icon: "i-bolt" },
    { value: "3s", label: "3s", description: "Wait 3 seconds", icon: "i-clock" },
    { value: "5s", label: "5s", description: "Wait 5 seconds", icon: "i-clock" },
    { value: "10s", label: "10s", description: "Wait 10 seconds", icon: "i-clock" },
  ],
}

const FORMAT: FieldDef = {
  key: "Format",
  description: "File type",
  options: [
    { value: "PNG", label: "PNG", description: "Lossless", icon: "i-image" },
    { value: "JPEG", label: "JPEG", description: "Smaller file", icon: "i-image" },
  ],
}

const OUTPUT: FieldDef = {
  key: "Output",
  description: "Where the result goes",
  options: [
    { value: "Clipboard", label: "Clipboard", description: "Copy only", icon: "i-clipboard" },
    { value: "Save", label: "Save", description: "Write to the folder", icon: "i-save" },
  ],
}

const CURSOR: FieldDef = {
  key: "Cursor",
  description: "Include the pointer in the shot",
  options: [
    { value: "On", label: "On", description: "Draw the pointer", icon: "i-cursor" },
    { value: "Off", label: "Off", description: "Hide the pointer", icon: "i-cursor-off" },
  ],
}

export const SCREENSHOT_FIELDS: ScreenshotFieldDefs = {
  target: TARGET,
  monitor: MONITOR,
  delay: DELAY,
  format: FORMAT,
  output: OUTPUT,
  cursor: CURSOR,
}

/** The shared Monitor field definition (REQ-011 consumes the same object). */
export const MONITOR_FIELD = MONITOR

// ---------------------------------------------------------------------------
// Typed-state <-> contract-value mapping.
//
// The contract speaks in the display vocabulary ("Region", "3s", "Clipboard");
// the runtime state speaks in the existing typed vocabulary ("region", 3,
// save=false). Keeping both directions here means the page and the window
// cannot invent a second spelling of a field value.
// ---------------------------------------------------------------------------

const TARGET_VALUES: Record<CaptureTarget, string> = {
  region: "Region",
  screen: "Screen",
  window: "Window",
}

const DELAY_VALUES: Record<number, string> = {
  0: "None",
  3: "3s",
  5: "5s",
  10: "10s",
}

const FORMAT_VALUES: Record<ScreenshotFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
}

export function screenshotTargetValue(target: CaptureTarget): string {
  return TARGET_VALUES[target]
}

export function screenshotTargetFromValue(value: string): CaptureTarget | null {
  for (const [target, label] of Object.entries(TARGET_VALUES)) {
    if (label === value) return target as CaptureTarget
  }
  return null
}

export function screenshotDelayValue(delay: number): string {
  return DELAY_VALUES[delay] ?? "None"
}

export function screenshotDelayFromValue(value: string): number | null {
  for (const [delay, label] of Object.entries(DELAY_VALUES)) {
    if (label === value) return Number(delay)
  }
  return null
}

export function screenshotFormatValue(format: ScreenshotFormat): string {
  return FORMAT_VALUES[format]
}

export function screenshotFormatFromValue(value: string): ScreenshotFormat | null {
  for (const [format, label] of Object.entries(FORMAT_VALUES)) {
    if (label === value) return format as ScreenshotFormat
  }
  return null
}

export function screenshotOutputValue(save: boolean): string {
  return save ? "Save" : "Clipboard"
}

export function screenshotOutputFromValue(value: string): boolean | null {
  if (value === "Save") return true
  if (value === "Clipboard") return false
  return null
}

export function screenshotCursorValue(cursor: boolean): string {
  return cursor ? "On" : "Off"
}

export function screenshotCursorFromValue(value: string): boolean | null {
  if (value === "On") return true
  if (value === "Off") return false
  return null
}
