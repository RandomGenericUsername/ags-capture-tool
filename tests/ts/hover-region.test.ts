// ---------------------------------------------------------------------------
// REQ-006 / SPIKE-001 option C: pointer-region reveal for the S4 hover HUD.
//
// The reveal must follow the whole normal S1 footprint while hidden state is
// fully click-through. That makes two things pure and testable: the footprint
// arithmetic (from the real S1 allocation, never a hardcoded 1546x54) and the
// arm-after-leave state machine. The source checks at the bottom pin the GTK
// wiring the Node suite cannot execute.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  barFootprint,
  createHoverRevealState,
  growHoverRect,
  hoverBarSize,
  pointerInRegion,
  updateHoverReveal,
  type HoverRect,
} from "../../domain/hover-region.ts"
import { parseCursorPosition } from "../../domain/pointer-position.ts"

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

const REGION: HoverRect = { x: 100, y: 200, width: 80, height: 40 }

// ---------------------------------------------------------------------------
// Footprint: derived from monitor + actual S1 allocation.
// ---------------------------------------------------------------------------

test("the footprint uses the measured S1 lane, not the compact HUD", () => {
  // Reference host: 1546x54 lane centred on a 1920x1080 output.
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      { width: 1546, height: 54 },
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 187, y: 1026, width: 1546, height: 54 },
  )
})

test("a different S1 allocation moves/resizes the footprint", () => {
  // The lane is not fixed: target/format/options change its width. Half the
  // width must move x to a different (centred) value and keep the bottom edge.
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      { width: 1123, height: 54 },
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 398, y: 1026, width: 1123, height: 54 },
  )
  // The compact HUD is 76x38: if that were used, x/y would differ. This pins
  // that the caller supplies the S1 allocation, not the HUD child's size.
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      { width: 76, height: 38 },
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 922, y: 1042, width: 76, height: 38 },
  )
})

test("top placement uses the actual top margin and monitor origin", () => {
  assert.deepEqual(
    barFootprint(
      { x: 1920, y: 0, width: 1920, height: 1080 },
      { width: 1546, height: 54 },
      { position: "top", marginTop: 48, marginBottom: 0 },
    ),
    { x: 2107, y: 48, width: 1546, height: 54 },
  )
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      { width: 1000, height: 54 },
      { position: "top", marginTop: 60, marginBottom: 0 },
    ),
    { x: 460, y: 60, width: 1000, height: 54 },
  )
})

test("invalid/zero geometry yields no region instead of a corner rect", () => {
  for (const surface of [
    { width: 0, height: 54 },
    { width: 1546, height: 0 },
    { width: Number.NaN, height: 54 },
  ]) {
    assert.equal(
      barFootprint(
        { x: 0, y: 0, width: 1920, height: 1080 },
        surface,
        { position: "bottom", marginTop: 0, marginBottom: 0 },
      ),
      null,
    )
  }
  assert.equal(
    barFootprint(
      { x: 0, y: 0, width: 0, height: 0 },
      { width: 1546, height: 54 },
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    null,
  )
})

// ---------------------------------------------------------------------------
// REQ-007: configured resting bar, not the S1 window.
// ---------------------------------------------------------------------------

test("the trigger uses the resting bar size, not the wider S1 window", () => {
  // Live reference: S1 lane 1506x54, resting bar 142x54, both on 1920x1080.
  const size = hoverBarSize(
    { connector: "eDP-1", width: 142, height: 54 },
    "eDP-1",
    { width: 1506, height: 54 },
  )
  assert.deepEqual(size, { width: 142, height: 54 })
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      size!,
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 889, y: 1026, width: 142, height: 54 },
  )
})

test("top placement and offset move the resting-bar rect", () => {
  const size = { width: 142, height: 54 }
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      size,
      { position: "top", marginTop: 60, marginBottom: 0 },
    ),
    { x: 889, y: 60, width: 142, height: 54 },
  )
  assert.deepEqual(
    barFootprint(
      { x: 0, y: 0, width: 1920, height: 1080 },
      size,
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 889, y: 1026, width: 142, height: 54 },
  )
})

test("monitor origin and logical scale are honored once, not multiplied", () => {
  // Logical 1280x720 at x=1920 is a 1920x1080 output at scale 1.5. Both the
  // monitor geometry and the widget allocation are already logical.
  assert.deepEqual(
    barFootprint(
      { x: 1920, y: 0, width: 1280, height: 720 },
      { width: 142, height: 54 },
      { position: "bottom", marginTop: 0, marginBottom: 0 },
    ),
    { x: 2489, y: 666, width: 142, height: 54 },
  )
})

test("a measurement from another monitor never reveals", () => {
  assert.equal(
    hoverBarSize(
      { connector: "DP-1", width: 142, height: 54 },
      "eDP-1",
      { width: 1506, height: 54 },
    ),
    null,
  )
  // Unknown connectors cannot prove a mismatch, so the measurement is used.
  assert.deepEqual(
    hoverBarSize(
      { connector: null, width: 142, height: 54 },
      "eDP-1",
      { width: 1506, height: 54 },
    ),
    { width: 142, height: 54 },
  )
})

test("a failed measurement falls back to the window footprint", () => {
  const window = { width: 1506, height: 54 }
  assert.deepEqual(hoverBarSize(null, "eDP-1", window), window)
  assert.deepEqual(
    hoverBarSize(
      { connector: "eDP-1", width: 0, height: 54 },
      "eDP-1",
      window,
    ),
    window,
  )
  assert.equal(hoverBarSize(null, "eDP-1", { width: 0, height: 54 }), null)
})

test("tolerance defaults to exact and grows symmetrically only when asked", () => {
  const rect = { x: 889, y: 1026, width: 142, height: 54 }
  assert.deepEqual(growHoverRect(rect, 0), rect)
  assert.deepEqual(growHoverRect(rect, -3), rect)
  assert.deepEqual(growHoverRect(rect, 2), {
    x: 887,
    y: 1024,
    width: 146,
    height: 58,
  })
  assert.equal(growHoverRect(null, 2), null)
})

// ---------------------------------------------------------------------------
// Hit test.
// ---------------------------------------------------------------------------

test("the hit test is inclusive-left/top and exclusive-right/bottom", () => {
  assert.equal(pointerInRegion({ x: 100, y: 200 }, REGION), true)
  assert.equal(pointerInRegion({ x: 179, y: 239 }, REGION), true)
  assert.equal(pointerInRegion({ x: 180, y: 200 }, REGION), false, "right edge is outside")
  assert.equal(pointerInRegion({ x: 100, y: 240 }, REGION), false, "bottom edge is outside")
  assert.equal(pointerInRegion({ x: 99, y: 200 }, REGION), false)
  assert.equal(pointerInRegion({ x: 100, y: 199 }, REGION), false)
  assert.equal(pointerInRegion(null, REGION), false, "unknown pointer is never a hit")
  assert.equal(pointerInRegion({ x: 100, y: 200 }, null), false, "no region is never a hit")
})

// ---------------------------------------------------------------------------
// Arm-after-leave reveal.
// ---------------------------------------------------------------------------

test("outside at start: the first enter reveals and leave hides", () => {
  let state = createHoverRevealState()
  const outside = { x: 10, y: 10 }
  const inside = { x: 120, y: 220 }

  state = updateHoverReveal(state, outside, REGION)
  assert.deepEqual(state, { armed: true, inside: false, revealed: false })

  state = updateHoverReveal(state, inside, REGION)
  assert.deepEqual(state, { armed: true, inside: true, revealed: true })

  state = updateHoverReveal(state, outside, REGION)
  assert.deepEqual(state, { armed: true, inside: false, revealed: false }, "leave hides immediately")

  state = updateHoverReveal(state, inside, REGION)
  assert.equal(state.revealed, true, "re-entry reveals again without a second arming")
})

test("inside at start is disarmed until the pointer leaves once (Record CTA)", () => {
  let state = createHoverRevealState()
  const inside = { x: 120, y: 220 }
  const outside = { x: 10, y: 10 }

  state = updateHoverReveal(state, inside, REGION)
  assert.deepEqual(state, { armed: false, inside: true, revealed: false }, "no first-frame HUD")

  state = updateHoverReveal(state, inside, REGION)
  assert.equal(state.revealed, false, "staying inside cannot arm the trigger")

  state = updateHoverReveal(state, outside, REGION)
  assert.deepEqual(state, { armed: true, inside: false, revealed: false }, "leaving arms it")

  state = updateHoverReveal(state, inside, REGION)
  assert.equal(state.revealed, true, "the next enter reveals")
})

test("a missing compositor/footprint never reveals and preserves arming", () => {
  let state = createHoverRevealState()
  state = updateHoverReveal(state, null, REGION)
  assert.deepEqual(state, { armed: false, inside: false, revealed: false })

  state = updateHoverReveal(state, { x: 120, y: 220 }, null)
  assert.equal(state.revealed, false, "an uncaptured footprint cannot reveal")

  state = updateHoverReveal(state, { x: 10, y: 10 }, REGION)
  assert.equal(state.armed, true)
  state = updateHoverReveal(state, null, REGION)
  assert.deepEqual(state, { armed: true, inside: false, revealed: false }, "a failed read hides but does not disarm")
})

// ---------------------------------------------------------------------------
// Hyprland response parsing (socket and hyprctl spellings).
// ---------------------------------------------------------------------------

test("cursorpos JSON parses with the socket's leading newline", () => {
  assert.deepEqual(parseCursorPosition('\n{\n    "x": 671,\n    "y": 788\n}\n'), {
    x: 671,
    y: 788,
  })
  assert.deepEqual(parseCursorPosition('{"x":0,"y":0}'), { x: 0, y: 0 })
})

test("a spy/warning prefix still yields the cursor object", () => {
  assert.deepEqual(parseCursorPosition('warning: something\n{"x": 5, "y": 6}\n'), {
    x: 5,
    y: 6,
  })
})

test("malformed or non-numeric replies are null, never (0,0)", () => {
  for (const text of ["", "not json", "{}", '{"x":"a","y":1}', '{"x":null,"y":1}', '{"x":1}', "[1,2]"]) {
    assert.equal(parseCursorPosition(text), null, text)
  }
})

// ---------------------------------------------------------------------------
// Source wiring: poll lifecycle, S1 capture point, no hardcoded footprint.
// ---------------------------------------------------------------------------

const WINDOW = read("ui", "classic", "ClassicWindow.tsx")
const ADAPTER = read("adapters", "hyprland-pointer-position.ts")
const APP = read("app.tsx")
const HUD_DOMAIN = read("domain", "recording-hud.ts")

test("the footprint is captured from the real bar allocation before S0 shrinks it", () => {
  const capture = functionBody(WINDOW, "function captureHoverFootprint()")
  assert.match(capture, /gdkmonitor\.get_geometry\(\)/)
  assert.match(capture, /hoverBarSize\(/)
  assert.match(capture, /restingBar/)
  assert.match(capture, /window\.get_width\(\)/)
  assert.match(capture, /window\.get_height\(\)/)
  assert.match(capture, /window\.margin_top/)
  assert.match(capture, /window\.margin_bottom/)
  assert.match(capture, /barFootprint\(/)
  assert.match(capture, /growHoverRect\(/)
  assert.doesNotMatch(capture, /1546|1026|76\b/, "no measured size may be hardcoded")

  // The resting bar is measured while S0 owns the real allocation; the hidden
  // rail at S1 measures 0, so this is the only moment its size is available.
  const sync = functionBody(WINDOW, "function syncWindowSize()")
  assert.match(sync, /rail\?\.visible/)
  assert.match(sync, /barState\.view === "home"/)
  assert.match(sync, /restingBar =/)
  assert.match(sync, /gdkmonitor\.get_connector\(\)/)
  assert.match(WINDOW, /const HOVER_TOLERANCE_PX = 0/)

  // Captured in hideBar while S1 is still allocated, before homeBar/apply.
  const commit = functionBody(WINDOW, "function commitCurrentMode()")
  assert.match(commit, /if \(committingRecording\) hoverFootprint = captureHoverFootprint\(\)/)
  assert.ok(
    commit.indexOf("hoverFootprint = captureHoverFootprint()") <
      commit.indexOf("barState = homeBar()"),
    "the S1 footprint must be read before the bar becomes S0",
  )
})

test("the poll runs only while hover is live and reads the pointer port", () => {
  assert.match(WINDOW, /const HOVER_POLL_MS = 50/)
  const poll = functionBody(WINDOW, "function syncHoverPoll()")
  assert.match(poll, /GLib\.timeout_add\(GLib\.PRIORITY_DEFAULT, HOVER_POLL_MS/)
  assert.match(poll, /ports\.pointerPosition\.current\(\)/)
  assert.match(poll, /updateHoverReveal\(/)
  assert.match(poll, /config\.bar\.recording_hud !== "hover"/)
  assert.match(poll, /hoverFootprint === null/)
  assert.match(poll, /if \(!isLive\(barState\)/)
  assert.match(poll, /stopHoverPoll\(\)/)
})

test("recording entry starts a clean poll; stop and destroy clear it", () => {
  const enter = functionBody(WINDOW, "function enterLiveHud()")
  assert.match(enter, /syncHoverPoll\(\)/)

  const leave = functionBody(WINDOW, "function leaveLiveHud()")
  assert.match(leave, /clearHoverReveal\(\)/)
  assert.match(leave, /const hoverMode = config\.bar\.recording_hud === "hover"/)
  assert.match(leave, /hideAfterStop \|\| hoverMode\) hideCaptureWindow\(\)/)
  assert.ok(
    leave.indexOf("clearHoverReveal()") < leave.indexOf("applyBarState()"),
    "the poll/footprint must be cleared before returning to S0",
  )

  const destroy = WINDOW.slice(WINDOW.indexOf('self.connect("destroy"'))
  assert.match(destroy, /clearHoverReveal\(\)/)
  assert.match(WINDOW, /function clearHoverReveal\(\)[\s\S]*?hoverFootprint = null[\s\S]*?hoverReveal = createHoverRevealState\(\)/)
})

test("the motion controller defers to the poll, so moving within S1 cannot hide it", () => {
  const motion = WINDOW.slice(WINDOW.indexOf("const motion = new Gtk.EventControllerMotion()"))
  const body = motion.slice(0, motion.indexOf('self.connect("map"'))
  assert.equal((body.match(/if \(hoverPoll !== null\) return/g) ?? []).length, 3)
})

test("hidden hover has no mapped surface; only reveal maps the normal HUD", () => {
  assert.match(
    HUD_DOMAIN,
    /case "hover":[\s\S]*?return \{ mapWindow: input\.pointerInside, showChrome: input\.pointerInside \}/,
  )
})

test("the adapter prefers the command socket and falls back to hyprctl", () => {
  assert.match(ADAPTER, /\.socket\.sock/)
  assert.match(ADAPTER, /j\/cursorpos/)
  assert.match(ADAPTER, /hyprctl -j cursorpos/)
  assert.match(ADAPTER, /parseCursorPosition\(/)
  assert.doesNotMatch(ADAPTER, /throw new Error|!ok\) throw/)
  assert.match(ADAPTER, /return null/, "missing compositor degrades to unknown")
})

test("the composition root wires the pointer port", () => {
  assert.match(APP, /pointerPosition: hyprlandPointerPosition\(\)/)
})
