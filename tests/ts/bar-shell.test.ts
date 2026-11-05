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

import {
  SETTINGS_GROUPS,
  SETTINGS_GROUP_TITLES,
  SETTINGS_ROW_NAMES,
} from "../../ui/shared/settings-defs.ts"

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
const UI_STATE = code(read("domain", "ui-state.ts"))
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

test("the Settings view paints its own opaque card while the window stays transparent", () => {
  const rule = /\.capture-view\s*\{([^}]*)\}/.exec(CSS)
  assert.ok(rule, "the .capture-view card rule is missing")
  const body = rule[1]
  // BUG-001: the Settings view is a sibling of the bar rows, so nothing else
  // paints a surface for it. @surface (not an alpha plate) is required for
  // readable labels over arbitrary windows.
  assert.match(body, /background-color:\s*@surface\s*;/)
  assert.doesNotMatch(body, /background-color:\s*transparent/)
  assert.match(body, /border:\s*1px solid alpha\(@on_surface,\s*0\.12\)/)
  assert.match(body, /border-radius:\s*18px/)
  assert.match(body, /padding:\s*18px/)
  // The first-frame fix stays intact: only the child paints chrome.
  assert.match(CSS, /window#capture-window\s*\{[^}]*background-color:\s*transparent/)
  // The resting bar's own plate is unchanged.
  assert.match(CSS, /\.capture-bar\s*\{[^}]*background-color:\s*alpha\(@surface,\s*0\.92\)/)
})

test("S1 screenshot renders one dropdown trigger per field, not option groups", () => {
  // EPIC-002 REQ-009: the screenshot lane's alternatives moved into field
  // popovers. The page owns only the order; ClassicWindow builds the handles.
  for (const field of ["target", "monitor", "delay", "format", "output", "cursor"]) {
    assert.match(
      SCREENSHOT,
      new RegExp(`fields\\.${field}\\.root`),
      `missing screenshot field ${field}`,
    )
  }
  assert.doesNotMatch(SCREENSHOT, /bar-group|bar-pill/, "no side-by-side option group remains")
  assert.match(SCREENSHOT, /fields\.target\.root[\s\S]*fields\.monitor\.root[\s\S]*fields\.delay\.root[\s\S]*fields\.format\.root[\s\S]*fields\.output\.root[\s\S]*fields\.cursor\.root/)

  // Every old screenshot option survives in the pure contract, not in the page.
  const defs = read("ui", "shared", "field-defs.ts")
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
    "On",
    "Off",
  ]) {
    assert.match(defs, new RegExp(`label: "${label}"`), `missing screenshot option ${label}`)
  }

  // The active value reaches every trigger from the one state-to-UI path.
  for (const field of ["target", "delay", "format", "output", "cursor"]) {
    assert.match(
      WINDOW,
      new RegExp(`screenshotFields\\.${field}\\.setValue\\(`),
      `applyStateToUi does not set ${field}`,
    )
  }
})

test("S1 recording renders one dropdown trigger per field, not option groups", () => {
  // EPIC-002 REQ-010: the recording lane's alternatives moved into the shared
  // field popovers. The page owns only the order; ClassicWindow builds the
  // handles. Field order is asserted against the mockup in
  // `dropdown-field.test.ts`.
  for (const field of [
    "target",
    "monitor",
    "fps",
    "format",
    "quality",
    "audio",
    "size",
    "duration",
    "cursor",
  ]) {
    assert.match(
      RECORDING,
      new RegExp(`fields\\.${field}\\.root`),
      `missing recording field ${field}`,
    )
  }
  assert.doesNotMatch(RECORDING, /bar-group|bar-pill/, "no side-by-side option group remains")
  assert.match(
    RECORDING,
    /fields\.target\.root[\s\S]*fields\.monitor\.root[\s\S]*fields\.fps\.root[\s\S]*fields\.format\.root[\s\S]*fields\.quality\.root[\s\S]*fields\.audio\.root[\s\S]*fields\.size\.root[\s\S]*fields\.duration\.root[\s\S]*fields\.cursor\.root/,
  )

  // Every old recording option survives in the pure contract, not in the page.
  const defs = read("ui", "shared", "field-defs.ts")
  for (const label of [
    "Region",
    "Screen",
    "Window",
    "24 fps",
    "30 fps",
    "60 fps",
    "10 fps",
    "15 fps",
    "20 fps",
    "Low",
    "Medium",
    "High",
    "System",
    "Mic",
    "None",
    "MP4",
    "WebM",
    "GIF",
    "Original",
    "75%",
    "50%",
    "∞",
    "10s",
    "30s",
    "60s",
    "Custom",
    "On",
    "Off",
  ]) {
    assert.match(defs, new RegExp(`label: "${label}"`), `missing recording option ${label}`)
  }

  // The active value reaches every trigger from the one state-to-UI path.
  for (const field of [
    "target",
    "fps",
    "format",
    "quality",
    "audio",
    "size",
    "duration",
    "cursor",
  ]) {
    assert.match(
      WINDOW,
      new RegExp(`recordingFields\\.${field}\\.setValue\\(`),
      `applyStateToUi does not set ${field}`,
    )
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

test("settings is entered from S0 only (INV-3), and shows Files/Behaviour/Placement/Runtime", () => {
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

  // REQ-012: the panel has exactly these four groups in this order. The list
  // is the pure settings-defs table the page consumes.
  assert.deepEqual(
    SETTINGS_GROUPS.map((group) => group.title),
    ["Files", "Behaviour", "Placement", "Runtime"],
  )
  assert.deepEqual(Object.values(SETTINGS_GROUP_TITLES), [
    "Files",
    "Behaviour",
    "Placement",
    "Runtime",
  ])
  assert.match(SETTINGS, /settingsGroups\(\)/, "the page consumes the settings-defs order")
  for (const def of ["filesDef", "behaviourDef", "placementDef", "runtimeDef"]) {
    assert.match(SETTINGS, new RegExp(`settingsGroup\\(${def}\\.title`), `missing group ${def}`)
  }

  for (const [key, label] of [
    ["screenshotFolder", "Screenshot folder"],
    ["recordingFolder", "Recording folder"],
    ["filenamePattern", "Filename pattern"],
    ["showNotifications", "Show notifications"],
    ["compactBarIndicator", "Compact bar indicator"],
    ["barPosition", "Bar position"],
    ["topOffset", "Top offset"],
    ["recordingControls", "Recording controls"],
    ["recorderBackend", "Recorder backend"],
    ["laneMemory", "Lane memory"],
  ] as const) {
    assert.equal(SETTINGS_ROW_NAMES[key], label)
    assert.match(
      SETTINGS,
      new RegExp(`SETTINGS_ROW_NAMES\\.${key}`),
      `missing settings row ${label}`,
    )
  }
})

test("settings no longer carries the duplicate Screenshot/Recording defaults", () => {
  // The bar dropdowns own these now; only cursor stays in config.json.
  for (const removed of [
    "Default format",
    "Default output",
    "Default frame rate",
    "Default quality",
    "Default audio",
    "Include cursor",
  ]) {
    assert.doesNotMatch(SETTINGS, new RegExp(`"${removed}"`), `removed row still present: ${removed}`)
  }
  assert.doesNotMatch(SETTINGS, /settingsConfig\.screenshot\.(format|output)/)
  assert.doesNotMatch(SETTINGS, /settingsConfig\.recording\.(fps|quality|audio)/)
  assert.doesNotMatch(SETTINGS, /"General"|"Screenshot"|"Recording"/)
  // The header and footer contract.
  assert.match(SETTINGS, /class="settings-subtitle"/)
  assert.match(SETTINGS, /class="settings-save-chip"/)
  assert.match(SETTINGS, /label="Saved as you go"/)
  assert.match(SETTINGS, /label="done"/)
  assert.match(SETTINGS, /The bar remembers every lane choice/)
  assert.match(CSS, /\.settings-subtitle\s*\{/)
  assert.match(CSS, /\.settings-save-chip\s*\{/)
})

test("first run loads code defaults, not settings defaults", () => {
  assert.match(WINDOW, /uiStateStore\.load\(createUiState\(\)\)/)
  assert.doesNotMatch(WINDOW, /configDefaults/)
  assert.doesNotMatch(UI_STATE, /export function configDefaults/)
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

test("the UI commits through the pending selection, never the legacy slurp path", () => {
  // REQ-003 supersedes the REQ-002 temporary commit: argv is still built by the
  // ONE translator, but only after a finished selection exists.
  assert.match(WINDOW, /screenshotArgs\(\{/)
  assert.match(WINDOW, /recordingArgs\(\{/)
  assert.match(WINDOW, /selection: finished/)
  assert.match(WINDOW, /runCommit\(\{/)
  assert.match(WINDOW, /hideOverlay:/)
  // The overlay itself lives in its own module; the bar keeps its identity.
  assert.doesNotMatch(WINDOW, /name="capture-overlay"/)
})
