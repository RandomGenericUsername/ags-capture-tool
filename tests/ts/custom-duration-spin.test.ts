// ---------------------------------------------------------------------------
// Custom-duration editor tests (REQ-010).
//
// The old inline `.custom-duration` spin grew the bar row. The editor now lives
// as a footer INSIDE the duration popover, which is a separate `Gdk.Popup`
// surface. GTK cannot be constructed under `node --test`, so this suite pins:
//
//   * the editor is a popover footer, not a bar child;
//   * Enter commits `customDuration`/`duration`, Esc restores the previous
//     selection;
//   * the editor is built once and only shown/hidden;
//   * the bar is never resized by the editor or by popover open/close.
//
// The pure value mapping (`15s` <-> 15, `∞` <-> 0) is executed against the real
// `field-defs.ts`.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  recordingDurationFromValue,
  recordingDurationValue,
} from "../../ui/shared/field-defs.ts"
import { createUiState, durationSelection } from "../../domain/ui-state.ts"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

function read(...parts: string[]): string {
  return readFileSync(fileURLToPath(new URL(parts.join("/"), `file://${ROOT}/`)), "utf8")
}

/** Source with `//` comment lines removed, so rationale cannot satisfy a test. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
}

const DROPDOWN = code(read("ui", "shared", "dropdown.ts"))
const WINDOW = code(read("ui", "classic", "ClassicWindow.tsx"))
const PAGE = code(read("ui", "classic", "RecordingPage.tsx"))

const DURATION_FIELD = DROPDOWN.slice(
  DROPDOWN.indexOf("export function durationField"),
)

test("the duration value maps to exact seconds and the Custom row", () => {
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

  const state = createUiState()
  state.recording.duration = 15
  assert.equal(durationSelection(state.recording), -1, "15s is a custom value")
  state.recording.duration = 30
  assert.equal(durationSelection(state.recording), 30, "30s is a preset")
})

test("custom duration is a popover footer, not an inline bar widget", () => {
  // The recording page is only field handles now.
  assert.doesNotMatch(PAGE, /custom-duration|customSpin|SpinButton/)
  assert.doesNotMatch(WINDOW, /class="custom-duration/)
  assert.doesNotMatch(WINDOW, /bar-custom-duration/)

  // The primitive appends the footer to the popover body, below the list.
  assert.match(DROPDOWN, /export function durationField/)
  assert.match(DROPDOWN, /body\.append\(config\.footer\.build\(controls\)\)/)
  assert.match(DURATION_FIELD, /editor\.add_css_class\("field-custom-editor"\)/)
  assert.match(DURATION_FIELD, /hint\.add_css_class\("field-custom-hint"\)/)
  assert.match(DURATION_FIELD, /footer\.append\(editor\)/)
})

test("Enter commits the editor and Esc restores the previous selection", () => {
  assert.match(DURATION_FIELD, /function commitCustom\(\)/)
  assert.match(
    DURATION_FIELD,
    /controls\.setValue\(`\$\{seconds\}s`, "Custom"\)/,
    "Enter must publish the exact seconds and keep the Custom row selected",
  )
  assert.match(DURATION_FIELD, /config\.onCustom\(seconds\)/)
  assert.match(DURATION_FIELD, /function restoreCustom\(\)/)
  assert.match(
    DURATION_FIELD,
    /controls\?\.setValue\(previousValue, previousSelected\)/,
    "Esc must restore the previous trigger value/row",
  )
  assert.match(
    DURATION_FIELD,
    /if \(keyval === Gdk\.KEY_Escape\) \{\s*restoreCustom\(\)/,
  )
  assert.match(
    DURATION_FIELD,
    /if \(keyval === Gdk\.KEY_Return \|\| keyval === Gdk\.KEY_KP_Enter\) \{\s*commitCustom\(\)/,
  )
  // The spin's internal text child can eat Enter before the popover sees it;
  // a capture-phase controller on the spin keeps the editor contract.
  assert.match(DURATION_FIELD, /const spinKeys = new Gtk\.EventControllerKey\(\)/)
  assert.match(
    DURATION_FIELD,
    /spinKeys\.connect\("key-pressed",[\s\S]*?editorKey\(keyval\)/,
  )
  // Closing without a choice/commit leaves the row agreeing with the trigger.
  assert.match(
    DURATION_FIELD,
    /if \(!committed\) controls\?\.setValue\(handle\.getValue\(\), previousSelected\)/,
  )
})

test("selecting Custom keeps the popover open and focuses the editor", () => {
  assert.match(
    DURATION_FIELD,
    /if \(value !== "Custom"\) return false/,
    "a preset row still closes the popover",
  )
  assert.match(DURATION_FIELD, /pending = true/)
  assert.match(DURATION_FIELD, /spin\.grab_focus\(\)/)
  assert.match(DURATION_FIELD, /if \(!pending \|\| !editorFocused\(\)\) return false/)
})

test("the editor is built once and only shown or hidden", () => {
  assert.match(DURATION_FIELD, /let editor: Gtk\.Box \| null = null/)
  assert.match(DURATION_FIELD, /editor\.visible = false/)
  assert.match(DURATION_FIELD, /function showEditor\(visible: boolean\)/)
  assert.match(
    DURATION_FIELD,
    /pending = handle\.getSelectedValue\(\) === "Custom"[\s\S]*?showEditor\(pending\)/,
  )
  assert.match(DURATION_FIELD, /showEditor\(false\)/)
})

test("the bar never resizes for the editor or a popover; format still does", () => {
  assert.doesNotMatch(DROPDOWN, /syncWindowSize/, "the primitive must not resize the bar")

  const format = WINDOW.slice(
    WINDOW.indexOf("format: dropdownField"),
    WINDOW.indexOf("quality: dropdownField"),
  )
  assert.match(format, /syncWindowSize\(\)/, "the GIF reflow must re-measure once")

  const duration = WINDOW.slice(
    WINDOW.indexOf("duration: durationField"),
    WINDOW.indexOf("cursor: dropdownField"),
  )
  assert.doesNotMatch(duration, /syncWindowSize/, "the duration editor must not grow the bar")
})
