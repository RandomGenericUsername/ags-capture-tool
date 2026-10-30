// ---------------------------------------------------------------------------
// Bar SHELL source assertions (REQ-002).
//
// The state transitions are executed in `bar-state.test.ts`; this suite pins the
// composition the acceptance checklist names and that GTK cannot be constructed
// under `node --test`: S0 has exactly the three icon entries, S1 reaches every
// existing option, settings is entered only from S0, and the window is never
// EXCLUSIVE.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

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

const WINDOW = code(read("ui", "classic", "ClassicWindow.tsx"))
const SCREENSHOT = code(read("ui", "classic", "ScreenshotPage.tsx"))
const RECORDING = code(read("ui", "classic", "RecordingPage.tsx"))
const SETTINGS = code(read("ui", "classic", "SettingsPage.tsx"))
const CSS = read("style.css")

test("S0 is the icon-only rail: camera, video, gear; no text labels", () => {
  const rail = /class="capture-bar rail"([\s\S]*?)class="capture-bar open"/.exec(WINDOW)
  assert.ok(rail, "the S0 rail block is missing")
  assert.equal((rail[1].match(/class="railicon"/g) ?? []).length, 3, "exactly three rail buttons")
  assert.match(rail[1], /withIcon\("camera"/)
  assert.match(rail[1], /withIcon\("video"/)
  assert.match(rail[1], /label="⚙"/)
  assert.doesNotMatch(rail[1], /label="Screenshot"|label="Recording"|label="Settings"/)
})

test("the S0 rail stays under 210px by construction", () => {
  // Three 38px icons + gaps + padding measured 142px on the live compositor.
  // GTK4 CSS has no max-width property (it logs a CSS error), so the ceiling is
  // the content and these are the inputs to it.
  assert.match(CSS, /\.railicon\s*\{[^}]*min-width:\s*38px/)
  assert.match(CSS, /\.capture-bar\s*\{[^}]*padding:\s*6px/)
  const rail = /class="capture-bar rail"([\s\S]*?)\$=\{\(self\)/.exec(WINDOW)
  assert.ok(rail, "the S0 rail block is missing")
  assert.match(rail[1], /spacing=\{4\}/)
  assert.doesNotMatch(CSS, /max-width\s*:/)
})

test("S1 screenshot keeps every existing screenshot option", () => {
  for (const label of [
    "Region",
    "Screen",
    "Window",
    "None",
    "3s",
    "5s",
    "10s",
    "PNG",
    "JPEG",
    "Clipboard",
    "Save",
    "Cursor",
    "Off",
  ]) {
    assert.match(SCREENSHOT, new RegExp(`label="${label}"`), `missing screenshot pill ${label}`)
  }
})

test("S1 recording keeps the capture vocabulary and the GIF/duration extras", () => {
  for (const label of [
    "Region",
    "Screen",
    "Window",
    "24",
    "30",
    "60",
    "Low",
    "Med",
    "High",
    "Sys",
    "Mic",
    "None",
    "MP4",
    "WebM",
    "GIF",
    "∞",
    "10s",
    "30s",
    "60s",
    "Custom",
    "Cursor",
    "Off",
  ]) {
    assert.match(RECORDING, new RegExp(`label="${label}"`), `missing recording pill ${label}`)
  }
})

test("the back chevron leads the opened row and the CTA closes it", () => {
  const backAt = WINDOW.indexOf('class="bar-back"')
  const openAt = WINDOW.indexOf('class="capture-bar open"')
  const ctaAt = WINDOW.indexOf('class="bar-cta"')
  assert.ok(openAt > -1 && backAt > openAt, "back chevron must be inside the opened row")
  assert.ok(ctaAt > backAt, "the CTA must sit after the options")
  assert.match(WINDOW, /onClicked=\{returnHome\}/, "back must return to S0")
  assert.match(WINDOW, /label="←"/)
})

test("settings is entered from S0 only (INV-3), and keeps its existing groups", () => {
  assert.equal(
    (WINDOW.match(/onClicked=\{openSettingsView\}/g) ?? []).length,
    1,
    "the settings entry must exist exactly once",
  )
  // It is inside the S0 rail block, before the opened row.
  const rail = WINDOW.indexOf('class="capture-bar rail"')
  const gear = WINDOW.indexOf("onClicked={openSettingsView}")
  const open = WINDOW.indexOf('class="capture-bar open"')
  assert.ok(gear > rail && gear < open, "settings must not be reachable from S1")

  for (const label of [
    "Screenshot folder",
    "Recording folder",
    "Filename pattern",
    "Show notifications",
    "Compact bar indicator",
    "Bar position",
    "Top offset",
  ]) {
    assert.match(SETTINGS, new RegExp(`"${label}"`), `missing settings row ${label}`)
  }
})

test("the bar is never EXCLUSIVE and reads placement from settings", () => {
  assert.match(WINDOW, /exclusivity=\{Astal\.Exclusivity\.IGNORE\}/)
  assert.doesNotMatch(WINDOW, /Exclusivity\.EXCLUSIVE/)
  assert.match(WINDOW, /anchor=\{initialTop \? Astal\.WindowAnchor\.TOP : Astal\.WindowAnchor\.BOTTOM\}/)
  assert.match(WINDOW, /margin_top=\{initialMargin\}/)
  assert.match(WINDOW, /barMarginTop\(/)
  assert.match(WINDOW, /monitorReservedTop\.reservedTop\(/)
})

test("a zero AstalHyprland reserved_top falls through to hyprctl", () => {
  // MEASURED live: AstalHyprland 0.1 reports reserved_top = 0 on this host
  // while hyprctl reports [0, 48, 0, 0]; 0 must not be treated as final.
  const RESERVED = code(read("adapters", "hyprland-monitor-reserved.ts"))
  assert.match(RESERVED, /value\s*>\s*0/)
  assert.match(RESERVED, /readHyprctl\(connector\)/)
})

test("the legacy commit path still launches the existing backend argv", () => {
  assert.match(WINDOW, /launcher\.launch\(screenshotArgs\(request\)\)/)
  assert.match(WINDOW, /launcher\.launch\(recordingArgs\(request\)\)/)
  // No REQ-003 overlay/pending machinery is invented in this ticket.
  assert.doesNotMatch(WINDOW, /capture-overlay|pending|geometry/i)
})
