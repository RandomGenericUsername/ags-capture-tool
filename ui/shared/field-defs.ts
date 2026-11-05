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

import type {
  AudioSource,
  CaptureTarget,
  GifScale,
  RecordingFormat,
  RecordingQuality,
  ScreenshotFormat,
} from "../../types"

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

/** The FPS field has one definition per format: `std` or `gif`. */
export interface FieldVariantDefs {
  readonly variants: {
    readonly std: FieldDef
    readonly gif: FieldDef
  }
}

export interface RecordingFieldDefs {
  readonly target: FieldDef
  readonly monitor: MonitorFieldDef
  readonly fps: FieldVariantDefs
  readonly format: FieldDef
  readonly quality: FieldDef
  readonly audio: FieldDef
  readonly size: FieldDef
  readonly duration: FieldDef
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
// Recording lane (REQ-010, EPIC-002 §3.3/§3.4).
// ---------------------------------------------------------------------------

/** Contract field order for the recording lane. */
export const RECORDING_FIELD_ORDER = [
  "target",
  "monitor",
  "fps",
  "format",
  "quality",
  "audio",
  "size",
  "duration",
  "cursor",
] as const

/**
 * Contract defaults for the recording lane (mockup `lanes.rec.defaults`).
 * Display defaults only; `domain/ui-state.ts` owns the runtime first-run state.
 */
export const RECORDING_DEFAULTS = {
  target: "Region",
  monitor: "eDP-1",
  fps: "60",
  gifFps: "15",
  format: "MP4",
  quality: "High",
  audio: "System",
  size: "Original",
  duration: "∞",
  cursor: "On",
} as const

const STD_FPS: FieldDef = {
  key: "FPS",
  description: "Frames per second",
  options: [
    { value: "24", label: "24 fps", description: "Cinematic", icon: "i-fps" },
    { value: "30", label: "30 fps", description: "Balanced", icon: "i-fps" },
    { value: "60", label: "60 fps", description: "Smooth", icon: "i-fps" },
  ],
}

const GIF_FPS: FieldDef = {
  key: "GIF FPS",
  description: "GIF frame rate",
  options: [
    { value: "10", label: "10 fps", description: "Smallest", icon: "i-fps" },
    { value: "15", label: "15 fps", description: "Balanced", icon: "i-fps" },
    { value: "20", label: "20 fps", description: "Smoother", icon: "i-fps" },
    { value: "30", label: "30 fps", description: "Smoothest", icon: "i-fps" },
  ],
}

const RECORDING_FORMAT: FieldDef = {
  key: "Format",
  description: "Recording container",
  options: [
    { value: "MP4", label: "MP4", description: "Most compatible", icon: "i-video" },
    { value: "WebM", label: "WebM", description: "Smaller, open format", icon: "i-video" },
    { value: "GIF", label: "GIF", description: "Looping, no audio", icon: "i-image" },
  ],
}

const RECORDING_QUALITY: FieldDef = {
  key: "Quality",
  description: "Encoder quality",
  options: [
    { value: "Low", label: "Low", description: "Smallest file", icon: "i-quality" },
    { value: "Medium", label: "Medium", description: "Balanced", icon: "i-quality" },
    { value: "High", label: "High", description: "Best detail", icon: "i-quality" },
  ],
}

const RECORDING_AUDIO: FieldDef = {
  key: "Audio",
  description: "Sound source",
  options: [
    { value: "System", label: "System", description: "Desktop output", icon: "i-speaker" },
    { value: "Mic", label: "Mic", description: "Microphone", icon: "i-mic" },
    { value: "None", label: "None", description: "Silent", icon: "i-mute" },
  ],
}

const RECORDING_SIZE: FieldDef = {
  key: "Size",
  description: "GIF output scale",
  options: [
    { value: "Original", label: "Original", description: "100%", icon: "i-image" },
    { value: "75%", label: "75%", description: "Three-quarter scale", icon: "i-image" },
    { value: "50%", label: "50%", description: "Half scale", icon: "i-image" },
  ],
}

const RECORDING_DURATION: FieldDef = {
  key: "Duration",
  description: "Stop automatically after",
  options: [
    { value: "∞", label: "∞", description: "Until stopped", icon: "i-infinity" },
    { value: "10s", label: "10s", description: "Stop after 10 seconds", icon: "i-clock" },
    { value: "30s", label: "30s", description: "Stop after 30 seconds", icon: "i-clock" },
    { value: "60s", label: "60s", description: "Stop after 60 seconds", icon: "i-clock" },
    { value: "Custom", label: "Custom", description: "Set exact seconds", icon: "i-clock" },
  ],
}

const RECORDING_CURSOR: FieldDef = {
  key: "Cursor",
  description: "Include the pointer in the recording",
  options: [
    { value: "On", label: "On", description: "Draw the pointer", icon: "i-cursor" },
    { value: "Off", label: "Off", description: "Hide the pointer", icon: "i-cursor-off" },
  ],
}

export const RECORDING_FIELDS: RecordingFieldDefs = {
  target: TARGET,
  monitor: MONITOR,
  fps: { variants: { std: STD_FPS, gif: GIF_FPS } },
  format: RECORDING_FORMAT,
  quality: RECORDING_QUALITY,
  audio: RECORDING_AUDIO,
  size: RECORDING_SIZE,
  duration: RECORDING_DURATION,
  cursor: RECORDING_CURSOR,
}

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

// ---------------------------------------------------------------------------
// Recording typed-state mappings (REQ-010).
// ---------------------------------------------------------------------------

const RECORDING_FORMAT_VALUES: Record<RecordingFormat, string> = {
  mp4: "MP4",
  webm: "WebM",
  gif: "GIF",
}

const RECORDING_QUALITY_VALUES: Record<RecordingQuality, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

const RECORDING_AUDIO_VALUES: Record<AudioSource, string> = {
  system: "System",
  microphone: "Mic",
  none: "None",
}

const RECORDING_SIZE_VALUES: Record<GifScale, string> = {
  original: "Original",
  "75%": "75%",
  "50%": "50%",
}

const RECORDING_DURATION_VALUES: Record<number, string> = {
  0: "∞",
  10: "10s",
  30: "30s",
  60: "60s",
}

export function recordingTargetValue(target: CaptureTarget): string {
  return TARGET_VALUES[target]
}

export function recordingTargetFromValue(value: string): CaptureTarget | null {
  return screenshotTargetFromValue(value)
}

/** `std` for MP4/WebM, `gif` for the GIF pipeline. */
export function recordingFpsDef(format: RecordingFormat): FieldDef {
  return format === "gif" ? GIF_FPS : STD_FPS
}

/** The FPS trigger value for the current format (GIF uses `gifFps`). */
export function recordingFpsValue(recording: {
  format: RecordingFormat
  fps: number
  gifFps: number
}): string {
  return String(recording.format === "gif" ? recording.gifFps : recording.fps)
}

export function recordingFpsFromValue(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function recordingFormatValue(format: RecordingFormat): string {
  return RECORDING_FORMAT_VALUES[format]
}

export function recordingFormatFromValue(value: string): RecordingFormat | null {
  for (const [format, label] of Object.entries(RECORDING_FORMAT_VALUES)) {
    if (label === value) return format as RecordingFormat
  }
  return null
}

export function recordingQualityValue(quality: RecordingQuality): string {
  return RECORDING_QUALITY_VALUES[quality]
}

export function recordingQualityFromValue(value: string): RecordingQuality | null {
  for (const [quality, label] of Object.entries(RECORDING_QUALITY_VALUES)) {
    if (label === value) return quality as RecordingQuality
  }
  return null
}

export function recordingAudioValue(audio: AudioSource): string {
  return RECORDING_AUDIO_VALUES[audio]
}

export function recordingAudioFromValue(value: string): AudioSource | null {
  for (const [audio, label] of Object.entries(RECORDING_AUDIO_VALUES)) {
    if (label === value) return audio as AudioSource
  }
  return null
}

export function recordingSizeValue(size: GifScale): string {
  return RECORDING_SIZE_VALUES[size]
}

export function recordingSizeFromValue(value: string): GifScale | null {
  for (const [size, label] of Object.entries(RECORDING_SIZE_VALUES)) {
    if (label === value) return size as GifScale
  }
  return null
}

/**
 * The duration trigger value: a preset label (`∞`, `10s`, `30s`, `60s`) or the
 * exact seconds for a custom value (`15s`). The `Custom` row is selected via
 * `durationSelection()`; it is never the trigger text.
 */
export function recordingDurationValue(duration: number): string {
  return RECORDING_DURATION_VALUES[duration] ?? `${duration}s`
}

/** Preset label -> seconds. `Custom` is not a value; it opens the editor. */
export function recordingDurationFromValue(value: string): number | null {
  for (const [duration, label] of Object.entries(RECORDING_DURATION_VALUES)) {
    if (label === value) return Number(duration)
  }
  const match = /^(\d+)s$/.exec(value)
  return match === null ? null : Number(match[1])
}

/** Which field occupies the Audio/Size slot for this format. */
export function recordingAudioOrSize(format: RecordingFormat): "audio" | "size" {
  return format === "gif" ? "size" : "audio"
}

export function recordingCursorValue(cursor: boolean): string {
  return screenshotCursorValue(cursor)
}

export function recordingCursorFromValue(value: string): boolean | null {
  return screenshotCursorFromValue(value)
}
