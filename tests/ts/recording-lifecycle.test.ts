// ---------------------------------------------------------------------------
// Recording lifecycle source + integration contracts (REQ-004).
//
// GTK cannot be constructed under `node --test`, so the parts that are pure
// (HUD transitions, timer, compact placement, the event-bus binding) are
// executed in the sibling suites. THIS file pins the wiring the acceptance
// checklist names: the red token comes from the palette, the live row is HUD
// only (no back, no options), Stop owns the exit, and a refresh never resets
// the HUD.
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

/** The `{...}` body of the function named by `marker`, comments stripped. */
function functionBody(source: string, marker: string): string {
  const clean = code(source)
  const start = clean.indexOf(marker)
  assert.notEqual(start, -1, `missing function marker: ${marker}`)
  const brace = clean.indexOf("{", start)
  let depth = 0
  for (let i = brace; i < clean.length; i += 1) {
    if (clean[i] === "{") depth += 1
    if (clean[i] === "}") {
      depth -= 1
      if (depth === 0) return clean.slice(brace + 1, i)
    }
  }
  throw new Error(`unterminated function body: ${marker}`)
}

const CSS = read("style.css")
const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
const WINDOW = code(read("ui", "classic", "ClassicWindow.tsx"))
const CLUSTER = code(read("ui", "shared", "recording-cluster.tsx"))
const PRESENTATION = read("domain", "recording-presentation.ts")
const SETTINGS_PAGE = code(read("ui", "classic", "SettingsPage.tsx"))
const SETTINGS_DOMAIN = read("domain", "settings.ts")
const HUD_DOMAIN = read("domain", "recording-hud.ts")
const BAR_STATE = read("domain", "bar-state.ts")
const COMMIT_ORDER = read("lib", "commit-order.ts")
const ADAPTER = read("adapters", "platform-capture-state-feed.ts")

test("the recording accent is one CSS token; the cluster keeps its fixed REC red", () => {
  assert.match(
    CSS_NO_COMMENTS,
    /:root\s*\{[^}]*--rec-accent:\s*@error\s*;/,
    "--rec-accent must map to the palette's @error (design.md §11.6)",
  )
  // The S4 lane and overlay chrome must never carry a literal colour. The
  // capture-drawn bar cluster is the deliberate exception: it reproduces the
  // bar's accepted design, whose one literal is the pulsing #e0605f REC dot.
  // Remove that pair of blocks before enforcing the palette-only rule.
  const paletteOnly = CSS_NO_COMMENTS
    .replace(/\.rec-dot\s*\{[^}]*\}/g, "")
    .replace(/@keyframes cluster-rec-pulse\s*\{[\s\S]*?\n\}/g, "")
  assert.doesNotMatch(paletteOnly, /#[0-9a-fA-F]{3,8}\b/)
  assert.match(CSS_NO_COMMENTS, /\.rec-dot\s*\{[^}]*background-color:\s*#e0605f/)
})

test("the recording lane and its overlay chrome read the token", () => {
  for (const selector of [
    ".bar-cta.record",
    ".capture-shell.recording .railicon.active",
    ".capture-shell.recording .bar-pill.selected",
    ".overlay-root.recording .selrect",
    ".overlay-root.recording .selhandle",
    ".overlay-root.recording .selring",
    ".overlay-root.recording .mon-outline.selected",
    ".overlay-root.recording .selbadge",
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const rule = new RegExp(`${escaped}[^{}]*\\{([^}]*)\\}`).exec(CSS_NO_COMMENTS)
    assert.ok(rule, `missing recording rule ${selector}`)
    assert.match(rule[1], /var\(--rec-accent\)|@error/, `${selector} must use the recording token`)
  }
  // The dim stays neutral: it describes what is excluded, not the mode.
  const dim = /\.overlay-dim\s*\{([^}]*)\}/.exec(CSS_NO_COMMENTS)
  assert.ok(dim)
  assert.doesNotMatch(dim[1], /--rec-accent|@error/)
})

test("the CTA label flips to Record exactly in the recording lane", () => {
  assert.match(WINDOW, /const recordingMode = barState\.view === "recording"/)
  assert.match(WINDOW, /ctaLabel\.set_label\(recordingMode \? "Record" : "Capture"\)/)
})

test("the overlay class is driven by the one OverlayView.mode value", () => {
  const overlay = read("ui", "overlay", "SelectionOverlay.tsx")
  assert.match(overlay, /if \(view\.mode === "recording"\) root\.add_css_class\("recording"\)/)
  assert.match(overlay, /else root\.remove_css_class\("recording"\)/)
})

test("S4 renders the shared bar cluster, not a second HUD design", () => {
  assert.match(WINDOW, /hudCluster = RecordingCluster\(/)
  assert.match(WINDOW, /\{hudCluster\?\.element \?\? null\}/)
  assert.doesNotMatch(WINDOW, /class="capture-bar hud"/)
  assert.doesNotMatch(WINDOW, /class="hud-dot"/)

  assert.match(CLUSTER, /class="rec-cluster"/)
  assert.match(CLUSTER, /class="rec-dot"/)
  assert.match(CLUSTER, /class="rec-timer"/)
  assert.match(CLUSTER, /class="rec-btn stop"/)
  assert.match(CLUSTER, /options\.onStop\(\)/)

  assert.doesNotMatch(CLUSTER, /bar-back|label="←"/, "INV-2: no back chevron in S4")
  assert.doesNotMatch(CLUSTER, /<RecordingPage|<ScreenshotPage/, "no option pages in S4")
  assert.doesNotMatch(CLUSTER, /label="(?:Region|Screen|Window|24|30|60|Low|Med|High|Sys|Mic|None)"/)
  assert.doesNotMatch(CLUSTER, /recordTargetGroup|recordFpsGroup|recordQualityGroup|recordAudioGroup/)
  assert.doesNotMatch(CLUSTER, /⚙|openSettingsView/, "options locked while live")
  assert.doesNotMatch(CLUSTER, /bar-kbd|label="Enter"/, "Enter is not a live-HUD action")
})

test("the S4 surface state has no Enter action and the bar state owns 'live'", () => {
  assert.match(BAR_STATE, /export function enterLive\(/)
  assert.match(BAR_STATE, /export function isLive\(/)
  assert.match(BAR_STATE, /view: "live", mode: "recording"/)
  assert.match(WINDOW, /if \(isLive\(barState\)\) return true/, "Esc/Enter are consumed in S4")
})

test("Stop publishes through hub.control and closes the HUD to S0", () => {
  const stop = functionBody(WINDOW, "function stopRecording()")
  assert.match(stop, /captureState\.control\(hud\.jobId, "stop"\)/)
  assert.match(stop, /hud = stoppedHud\(hud, Date\.now\(\)\)/)
  assert.match(stop, /leaveLiveHud\(\)/)

  const leave = functionBody(WINDOW, "function leaveLiveHud()")
  assert.match(leave, /barState = homeBar\(\)/)
  assert.match(leave, /applyBarState\(\)/)
})

test("Pause/Resume publish the pure action for the current phase", () => {
  const toggle = functionBody(WINDOW, "function togglePause()")
  assert.match(toggle, /captureState\.control\(hud\.jobId, pauseAction\(hud\)\)/)
})

test("Stop racing the first snapshot stops the job when its id arrives", () => {
  const stop = functionBody(WINDOW, "function stopRecording()")
  assert.match(stop, /else hudStopPending = true/)

  const feed = functionBody(WINDOW, "function onCaptureState(")
  assert.match(feed, /if \(hudStopPending\)/)
  assert.match(feed, /captureState\.control\(next\.jobId, "stop"\)/)
  assert.match(feed, /hud = stoppedHud\(next, Date\.now\(\)\)/)
})

test("the live feed is the platform event bus, subscribed once per window", () => {
  assert.match(ADAPTER, /from "ags-platform\/adapters\/event-bus"/)
  assert.match(WINDOW, /captureState\.subscribe\(onCaptureState\)/)
  assert.match(WINDOW, /captureState\.onRestart\(/)
  assert.match(WINDOW, /reduceCaptureState\(hud, payload, Date\.now\(\)\)/)
  assert.match(WINDOW, /if \(isLive\(barState\)\) leaveLiveHud\(\)/, "terminal bus state leaves S4")
})

test("bar_compact_controls moves the shared controls, never the state", () => {
  assert.match(WINDOW, /hudControlPlacement\(config\.bar_compact_controls\)/)
  assert.match(WINDOW, /if \(!placement\.popup\) hudCluster\?\.closePopover\(\)/)
  assert.match(CLUSTER, /inlineToggle\.visible = !state\.compact/)
  assert.match(CLUSTER, /if \(!state\.compact\) popover\?\.popdown\(\)/)
})

test("recording commit stays hide-overlay -> hide-bar -> HUD -> launch", () => {
  assert.match(COMMIT_ORDER, /sequence\.hideOverlay\(\)/)
  assert.match(COMMIT_ORDER, /sequence\.hideBar\(\)/)
  assert.match(COMMIT_ORDER, /sequence\.showHud\?\.\(\)/)
  assert.match(COMMIT_ORDER, /sequence\.launch\(\)/)
  assert.match(
    WINDOW,
    /showHud: committingRecording \? enterLiveHud : undefined/,
    "only recording re-maps the bar as the HUD",
  )
  const commit = functionBody(WINDOW, "function commitCurrentMode()")
  assert.ok(
    commit.indexOf("showHud:") < commit.indexOf("launch:"),
    "the HUD must be restored before the launcher receives argv",
  )
})

test("a palette refresh re-measures the HUD window without resetting it", () => {
  const surface = functionBody(WINDOW, "unregisterAppearance = appearanceRegistry.register")
  assert.match(surface, /refreshWindow: syncWindowSize/)
  assert.doesNotMatch(surface, /idleHud\(\)|stoppedHud\(|hud\s*=|barState\s*=|\.visible\s*=/)
})

// ---------------------------------------------------------------------------
// D9 / design.md §6: settings-driven S4 chrome visibility.
// ---------------------------------------------------------------------------

test("recording_controls is tolerant and defaults to the top bar", () => {
  assert.match(SETTINGS_DOMAIN, /recording_controls: DEFAULT_RECORDING_CONTROLS/)
  assert.match(SETTINGS_DOMAIN, /resolveRecordingControls\(/)
  assert.match(
    SETTINGS_DOMAIN,
    /resolveRecordingControls\(\s*record\.recording_controls,\s*bar\.recording_hud/,
    "the old key must keep migrating",
  )
  assert.match(
    SETTINGS_DOMAIN,
    /from "\.\/recording-presentation\.ts"/,
    "the pure presentation contract is the source of truth",
  )
})

test("the settings page exposes the three unified modes and persists them", () => {
  assert.match(SETTINGS_PAGE, /pillRow<RecordingControlsMode>\(\s*"Recording controls"/)
  for (const [label, value] of [
    ["Top bar", "top-bar"],
    ["On hover", "hover"],
    ["Always visible", "always"],
  ] as const) {
    assert.match(
      SETTINGS_PAGE,
      new RegExp(`\\{ label: "${label}", value: "${value}" \\}`),
      `missing recording-controls mode ${label}`,
    )
  }
  assert.doesNotMatch(SETTINGS_PAGE, /\{ label: "Hidden", value: "hidden" \}/)
  assert.match(SETTINGS_PAGE, /settingsConfig\.recording_controls = value/)
  // The row builder persists via RowContext, the same chain as bar placement.
  assert.match(SETTINGS_PAGE, /rowContext,/)
})

test("the pure visibility rule is the only S4 decision", () => {
  assert.match(HUD_DOMAIN, /export function hudVisibility\(/)
  assert.match(HUD_DOMAIN, /case "always":/)
  assert.match(HUD_DOMAIN, /case "hover":/)
  assert.match(HUD_DOMAIN, /case "hidden":/)
  const apply = functionBody(WINDOW, "function applyHudVisibility()")
  assert.match(apply, /hudVisibility\(\{/)
  assert.match(apply, /mode: current\.captureBar/)
  assert.match(apply, /allowLauncherHud: current\.allowLauncherHud/)
  assert.match(apply, /live,/)
  assert.match(apply, /pointerInside,/)
  assert.match(apply, /presentedByLauncher: hudPresentedByLauncher/)
  // Opacity, not visibility: hover keeps a real hit area while chrome is off.
  assert.match(apply, /hudRow\.opacity = visibility\.showChrome \? 1 : 0/)
  // A popover is a separate surface, so it must close with hidden chrome.
  assert.match(apply, /if \(!visibility\.showChrome\) hudPopup\?\.popdown\(\)/)
})

test("top-bar mode does not auto-map the capture HUD after commit", () => {
  const enter = functionBody(WINDOW, "function enterLiveHud()")
  assert.match(enter, /applyBarState\(\)/)
  assert.doesNotMatch(
    enter,
    /captureWindow\.visible = true|captureWindow\.present\(\)/,
    "enterLiveHud must not map the window itself; the pure rule decides",
  )
  // The commit sequence is unchanged: recording still offers the HUD step.
  const commit = functionBody(WINDOW, "function commitCurrentMode()")
  assert.match(commit, /showHud: committingRecording \? enterLiveHud : undefined/)
})

test("top-bar mode cannot use the capture launcher as a manual override", () => {
  assert.match(
    WINDOW,
    /const current = surfaces\(\)\s+if \(\s*isLive\(barState\) &&\s*current\.allowLauncherHud &&\s*current\.captureBar === "hidden"/,
  )
  // The pure rule says top-bar disables the launcher override.
  assert.match(PRESENTATION, /case "top-bar":\s*return \{ topBar: true, captureBar: "hidden", allowLauncherHud: false \}/)
  assert.match(WINDOW, /recordingSurfaces\(/)
})

test("hover installs a pointer controller that only re-applies visibility", () => {
  assert.match(WINDOW, /new Gtk\.EventControllerMotion\(\)/)
  assert.match(WINDOW, /motion\.connect\("enter",[\s\S]*?pointerInside = true/)
  assert.match(WINDOW, /motion\.connect\("leave",[\s\S]*?pointerInside = false/)
  assert.match(WINDOW, /self\.add_controller\(motion\)/)
  const motion = WINDOW.slice(WINDOW.indexOf("const motion = new Gtk.EventControllerMotion()"))
  const body = motion.slice(0, motion.indexOf('self.connect("map"'))
  assert.doesNotMatch(body, /captureState\.control|launcher\.launch|\bhud =/)
  assert.match(body, /if \(isLive\(barState\)\) applyHudVisibility\(\)/)
})

test("launcher-presented chrome is hidden again on stop", () => {
  const leave = functionBody(WINDOW, "function leaveLiveHud()")
  assert.match(leave, /current\.captureBar === "hidden" && hudPresentedByLauncher/)
  assert.match(leave, /hideAfterStop/)
  assert.match(leave, /hideCaptureWindow\(\)/)
  assert.match(leave, /hudPresentedByLauncher = false/)
})

test("Stop remains in the S4 shared cluster for every visibility mode", () => {
  assert.match(WINDOW, /onStop: stopRecording/)
  assert.match(CLUSTER, /class="rec-btn stop"/)
  assert.match(CLUSTER, /class="rec-popup-action danger"/)
  // The row itself must stay built even when its chrome is at opacity 0.
  assert.match(WINDOW, /if \(hudRow\) hudRow\.visible = live/)
})
