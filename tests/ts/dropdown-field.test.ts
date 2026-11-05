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
  SCREENSHOT_DEFAULTS,
  SCREENSHOT_FIELDS,
  SCREENSHOT_FIELD_ORDER,
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

function contract(): {
  version: number
  lanes: {
    shot: {
      fields: string[]
      defaults: Record<string, string>
      defs: Record<
        string,
        {
          key: string
          desc: string
          source?: string
          options?: string[][]
        }
      >
    }
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
  assert.equal(openBlocks.length, 6, "expected one onOpen per screenshot field")
  for (const block of openBlocks) {
    assert.doesNotMatch(block, /syncWindowSize/)
  }
  const closeBlocks = WINDOW.match(/onClose: \(\) => \{[\s\S]*?\n      \},/g) ?? []
  assert.equal(closeBlocks.length, 6, "expected one onClose per screenshot field")
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
