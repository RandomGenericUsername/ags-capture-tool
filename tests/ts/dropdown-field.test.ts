// ---------------------------------------------------------------------------
// REQ-009 source/contract tests for the capture field primitive.
//
// GTK cannot be constructed under `node --test`, so this suite pins:
//   * `field-defs.ts` against the mockup's design-contract JSON (screenshot
//     lane: order, defaults, keys, descriptions, every option tuple);
//   * the dropdown handle's public surface and its MenuButton/Popover/ListBox
//     implementation;
//   * the window wiring: popover open/close never calls `syncWindowSize()`,
//     Target changes do, Enter/Esc/arrows are deferred while open, commit
//     closes fields first, and Cursor persists through `settingsStore`.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  DESIGN_CONTRACT_VERSION,
  RECORDING_DEFAULTS,
  RECORDING_FIELDS,
  RECORDING_FIELD_ORDER,
  SCREENSHOT_DEFAULTS,
  SCREENSHOT_FIELDS,
  SCREENSHOT_FIELD_ORDER,
  recordingAudioFromValue,
  recordingAudioOrSize,
  recordingAudioValue,
  recordingCursorFromValue,
  recordingCursorValue,
  recordingDurationFromValue,
  recordingDurationValue,
  recordingFormatFromValue,
  recordingFormatValue,
  recordingFpsDef,
  recordingFpsFromValue,
  recordingFpsValue,
  recordingQualityFromValue,
  recordingQualityValue,
  recordingSizeFromValue,
  recordingSizeValue,
  recordingTargetFromValue,
  recordingTargetValue,
  screenshotCursorFromValue,
  screenshotCursorValue,
  screenshotDelayFromValue,
  screenshotDelayValue,
  screenshotFormatFromValue,
  screenshotFormatValue,
  screenshotOutputFromValue,
  screenshotOutputValue,
  screenshotTargetFromValue,
  screenshotTargetValue,
  type RecordingFieldDefs,
  type ScreenshotFieldDefs,
} from "../../ui/shared/field-defs.ts"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

function read(...parts: string[]): string {
  return readFileSync(fileURLToPath(new URL(parts.join("/"), `file://${ROOT}/`)), "utf8")
}

function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
}

const MOCKUP = read(
  "tickets",
  "EPIC-002-monitor-catalog-dropdowns",
  "mockups",
  "capture-tool-dropdowns.html",
)
const WINDOW = code(read("ui", "classic", "ClassicWindow.tsx"))
const DROPDOWN = code(read("ui", "shared", "dropdown.ts"))
const FIELD_DEFS_SOURCE = read("ui", "shared", "field-defs.ts")
const CSS = read("style.css")

interface ContractLane {
  fields: string[]
  defaults: Record<string, string>
  defs: Record<
    string,
    {
      key?: string
      desc?: string
      source?: string
      options?: string[][]
      variants?: Record<
        string,
        { key: string; desc: string; options: string[][] }
      >
    }
  >
}

function contract(): {
  version: number
  lanes: {
    shot: ContractLane
    rec: ContractLane
  }
} {
  const match =
    /<script type="application\/json" id="design-contract">([\s\S]*?)<\/script>/.exec(MOCKUP)
  assert.ok(match, "the mockup design-contract block is missing")
  return JSON.parse(match[1]) as ReturnType<typeof contract>
}

test("field-defs.ts is pure: no ags/* and no gi://* imports", () => {
  assert.doesNotMatch(FIELD_DEFS_SOURCE, /from\s+["']ags\//)
  assert.doesNotMatch(FIELD_DEFS_SOURCE, /from\s+["']gi:\/\//)
})

test("the screenshot lane matches the mockup design-contract exactly", () => {
  const shot = contract().lanes.shot
  assert.equal(DESIGN_CONTRACT_VERSION, contract().version)
  assert.deepEqual([...SCREENSHOT_FIELD_ORDER], shot.fields)
  assert.deepEqual(SCREENSHOT_DEFAULTS, shot.defaults)

  for (const field of SCREENSHOT_FIELD_ORDER) {
    const expected = shot.defs[field]
    const actual = SCREENSHOT_FIELDS[field as keyof ScreenshotFieldDefs]
    assert.ok(expected, `contract has no ${field} definition`)
    assert.equal(actual.key, expected.key, `${field} key drifted`)
    assert.equal(actual.description, expected.desc, `${field} description drifted`)
    if (expected.source !== undefined) {
      assert.equal("source" in actual && actual.source, expected.source)
      continue
    }
    assert.ok("options" in actual)
    assert.deepEqual(
      actual.options,
      (expected.options ?? []).map(([value, label, description, icon]) => ({
        value,
        label,
        description,
        icon,
      })),
      `${field} options drifted`,
    )
  }
})

test("the recording lane matches the mockup design-contract exactly", () => {
  const rec = contract().lanes.rec
  assert.deepEqual([...RECORDING_FIELD_ORDER], rec.fields)
  assert.deepEqual(RECORDING_DEFAULTS, rec.defaults)

  for (const field of RECORDING_FIELD_ORDER) {
    const expected = rec.defs[field]
    const actual = RECORDING_FIELDS[field as keyof RecordingFieldDefs]
    assert.ok(expected, `contract has no ${field} definition`)

    if (field === "fps") {
      const variants = (actual as RecordingFieldDefs["fps"]).variants
      for (const variant of ["std", "gif"] as const) {
        const def = expected.variants?.[variant]
        assert.ok(def, `contract has no ${variant} FPS variant`)
        assert.equal(variants[variant].key, def.key, `${variant} FPS key drifted`)
        assert.equal(
          variants[variant].description,
          def.desc,
          `${variant} FPS description drifted`,
        )
        assert.deepEqual(
          variants[variant].options,
          def.options.map(([value, label, description, icon]) => ({
            value,
            label,
            description,
            icon,
          })),
          `${variant} FPS options drifted`,
        )
      }
      continue
    }

    const actualDef = actual as
      | RecordingFieldDefs["target"]
      | RecordingFieldDefs["monitor"]
    assert.equal(actualDef.key, expected.key, `${field} key drifted`)
    assert.equal(actualDef.description, expected.desc, `${field} description drifted`)
    if (expected.source !== undefined) {
      assert.equal("source" in actualDef && actualDef.source, expected.source)
      continue
    }
    assert.ok("options" in actualDef)
    assert.deepEqual(
      actualDef.options,
      (expected.options ?? []).map(([value, label, description, icon]) => ({
        value,
        label,
        description,
        icon,
      })),
      `${field} options drifted`,
    )
  }
})

test("the typed-state mapping round-trips every screenshot option", () => {
  for (const [target, value] of [
    ["region", "Region"],
    ["screen", "Screen"],
    ["window", "Window"],
  ] as const) {
    assert.equal(screenshotTargetValue(target), value)
    assert.equal(screenshotTargetFromValue(value), target)
  }
  for (const [delay, value] of [
    [0, "None"],
    [3, "3s"],
    [5, "5s"],
    [10, "10s"],
  ] as const) {
    assert.equal(screenshotDelayValue(delay), value)
    assert.equal(screenshotDelayFromValue(value), delay)
  }
  assert.equal(screenshotFormatValue("png"), "PNG")
  assert.equal(screenshotFormatFromValue("JPEG"), "jpeg")
  assert.equal(screenshotOutputValue(false), "Clipboard")
  assert.equal(screenshotOutputValue(true), "Save")
  assert.equal(screenshotOutputFromValue("Save"), true)
  assert.equal(screenshotCursorValue(true), "On")
  assert.equal(screenshotCursorValue(false), "Off")
  assert.equal(screenshotCursorFromValue("On"), true)
  assert.equal(screenshotCursorFromValue("Off"), false)
})

test("the typed-state mapping round-trips every recording option", () => {
  for (const [target, value] of [
    ["region", "Region"],
    ["screen", "Screen"],
    ["window", "Window"],
  ] as const) {
    assert.equal(recordingTargetValue(target), value)
    assert.equal(recordingTargetFromValue(value), target)
  }
  for (const [format, value] of [
    ["mp4", "MP4"],
    ["webm", "WebM"],
    ["gif", "GIF"],
  ] as const) {
    assert.equal(recordingFormatValue(format), value)
    assert.equal(recordingFormatFromValue(value), format)
  }
  for (const [quality, value] of [
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
  ] as const) {
    assert.equal(recordingQualityValue(quality), value)
    assert.equal(recordingQualityFromValue(value), quality)
  }
  for (const [audio, value] of [
    ["system", "System"],
    ["microphone", "Mic"],
    ["none", "None"],
  ] as const) {
    assert.equal(recordingAudioValue(audio), value)
    assert.equal(recordingAudioFromValue(value), audio)
  }
  for (const [size, value] of [
    ["original", "Original"],
    ["75%", "75%"],
    ["50%", "50%"],
  ] as const) {
    assert.equal(recordingSizeValue(size), value)
    assert.equal(recordingSizeFromValue(value), size)
  }
  for (const [duration, value] of [
    [0, "∞"],
    [10, "10s"],
    [30, "30s"],
    [60, "60s"],
    [15, "15s"],
  ] as const) {
    assert.equal(recordingDurationValue(duration), value)
    assert.equal(recordingDurationFromValue(value), duration)
  }
  assert.equal(recordingDurationFromValue("Custom"), null)
  assert.equal(recordingCursorValue(true), "On")
  assert.equal(recordingCursorFromValue("Off"), false)
  assert.equal(recordingFpsFromValue("60"), 60)
})

test("GIF switches the FPS vocabulary and the Audio/Size slot in place", () => {
  // The stored std fps/audio are never overwritten by the conditional state;
  // only the visible vocabulary and the occupied slot change.
  const recording = {
    format: "mp4" as "mp4" | "webm" | "gif",
    fps: 60,
    gifFps: 15,
    audio: "system" as "system" | "microphone" | "none",
  }

  assert.equal(recordingFpsDef(recording.format).key, "FPS")
  assert.equal(recordingFpsValue(recording), "60")
  assert.equal(recordingAudioOrSize(recording.format), "audio")

  recording.format = "gif"
  assert.equal(recordingFpsDef(recording.format).key, "GIF FPS")
  assert.deepEqual(
    recordingFpsDef(recording.format).options.map((option) => option.value),
    ["10", "15", "20", "30"],
  )
  assert.equal(recordingFpsValue(recording), "15")
  assert.equal(recordingAudioOrSize(recording.format), "size")

  recording.format = "mp4"
  assert.equal(recordingFpsDef(recording.format).key, "FPS")
  assert.equal(recordingFpsValue(recording), "60", "std FPS survived the round trip")
  assert.equal(recording.audio, "system", "std audio survived the round trip")
  assert.equal(recordingAudioOrSize(recording.format), "audio")
})

test("dropdown.ts exposes the reusable handle and uses Button + Popover + ListBox", () => {
  assert.match(DROPDOWN, /export function dropdownField/)
  assert.match(DROPDOWN, /export interface DropdownFieldHandle/)
  for (const method of [
    "setValue",
    "setOptions",
    "setEnabled",
    "setVisible",
    "open",
    "close",
    "isOpen",
    "destroy",
  ]) {
    assert.match(DROPDOWN, new RegExp(`\\b${method}\\b`), `handle is missing ${method}`)
  }
  assert.match(DROPDOWN, /Gtk\.Button/)
  assert.match(DROPDOWN, /Gtk\.Popover/)
  assert.match(DROPDOWN, /Gtk\.ListBox/)
  assert.match(DROPDOWN, /popover\.connect\("map"[\s\S]*config\.onOpen/)
  assert.match(DROPDOWN, /popover\.connect\("closed"[\s\S]*config\.onClose/)
  assert.doesNotMatch(DROPDOWN, /syncWindowSize/, "the primitive must not resize the bar")
})

test("opening/closing a popover never calls syncWindowSize; Target still does", () => {
  const openBlocks = WINDOW.match(/onOpen: \(\) => \{[\s\S]*?\n      \},/g) ?? []
  assert.equal(openBlocks.length, 15, "expected one onOpen per field in both lanes")
  for (const block of openBlocks) {
    assert.doesNotMatch(block, /syncWindowSize/)
  }
  const closeBlocks = WINDOW.match(/onClose: \(\) => \{[\s\S]*?\n      \},/g) ?? []
  assert.equal(closeBlocks.length, 15, "expected one onClose per field in both lanes")
  for (const block of closeBlocks) {
    assert.doesNotMatch(block, /syncWindowSize/)
  }

  const targetChanged = WINDOW.slice(
    WINDOW.indexOf("function targetChanged"),
    WINDOW.indexOf("function closeSettings"),
  )
  assert.match(targetChanged, /selection\.retarget/)
  assert.match(targetChanged, /applyBarState\(\)/)
  const applyBarState = WINDOW.slice(
    WINDOW.indexOf("function applyBarState"),
    WINDOW.indexOf("function selectMode"),
  )
  assert.match(applyBarState, /syncWindowSize\(\)/)
})

test("the capture-phase controller defers to an open popover and commit closes fields", () => {
  const onKey = WINDOW.slice(WINDOW.indexOf("function onKey"), WINDOW.indexOf("function applyStateToUi"))
  assert.match(onKey, /activePopover !== null && activePopover\.isOpen\(\)/)
  assert.match(onKey, /return false/)
  for (const key of ["KEY_Escape", "KEY_Return", "KEY_Up", "KEY_Down"]) {
    assert.match(onKey, new RegExp(key))
  }

  const commit = WINDOW.slice(
    WINDOW.indexOf("function commitCurrentMode"),
    WINDOW.indexOf("function onKey"),
  )
  const closeAt = commit.indexOf("closeAllFields()")
  const runAt = commit.indexOf("runCommit(")
  assert.ok(closeAt > -1, "commit must close every open field")
  assert.ok(runAt > closeAt, "closeAllFields() must run before runCommit()")
})

test("Cursor writes settingsStore and updates the trigger", () => {
  const setter = WINDOW.slice(
    WINDOW.indexOf("function setScreenshotCursor"),
    WINDOW.indexOf("function setRecordingCursor"),
  )
  assert.match(setter, /settingsStore\.save\(config\)/)
  assert.match(setter, /screenshotFields\.cursor\.setValue\(screenshotCursorValue\(value\)\)/)
  assert.match(
    WINDOW,
    /onSelect: \(value\) => \{\s*const next = screenshotCursorFromValue\(value\)[\s\S]*?setScreenshotCursor\(next\)/,
  )
})

test("style.css defines every field class with palette tokens only", () => {
  for (const className of [
    "field",
    "field-trigger",
    "field-key",
    "field-value",
    "field-chevron",
    "field-popover",
    "field-pop-header",
    "field-pop-title",
    "field-pop-desc",
    "field-option",
    "field-option-icon",
    "field-option-text",
    "field-option-label",
    "field-option-desc",
    "field-radio",
    "field-selected",
    "field-custom-editor",
    "field-custom-hint",
  ]) {
    assert.match(CSS, new RegExp(`\\.${className}\\b`), `missing .${className}`)
  }
  const start = CSS.indexOf("Field trigger/popover")
  const end = CSS.indexOf("capture-drawn cluster")
  assert.ok(start > -1 && end > start, "the field CSS block is missing")
  const fieldCss = CSS.slice(start, end)
  assert.doesNotMatch(fieldCss, /#[0-9a-fA-F]{3,8}\b/, "field CSS must not use literal colours")
})
