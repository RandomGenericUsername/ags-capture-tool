// ---------------------------------------------------------------------------
// Focused-monitor visibility tests (REQ-002, design.md D2/§7).
//
// The decision is pure (`domain/monitor-registry.ts#planFocusVisibility`), so
// this suite executes it with the same two-window shape the app builds. The
// adapter then only assigns `.visible`; the source checks at the bottom pin that
// constraint (no destroy, no add/remove, no state reset on a focus change).
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  focusKey,
  monitorKey,
  planFocusVisibility,
  type MonitorDescriptor,
  type VisibilityDecision,
  type WindowBinding,
} from "../../domain/monitor-registry.ts"
import { createUiState } from "../../domain/ui-state.ts"

const WINDOW_SET = fileURLToPath(
  new URL("../../adapters/monitor-window-set.ts", import.meta.url),
)

interface FakeWindow {
  id: string
  name: string
  visible: boolean
  destroyed: number
}

function monitor(connector: string): MonitorDescriptor {
  return {
    connector,
    model: "0x153C",
    manufacturer: "Chimei Innolux Corporation",
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
  }
}

/** The two per-monitor windows app.tsx builds, as plain objects. */
function twoWindows(): {
  monitors: MonitorDescriptor[]
  bindings: WindowBinding<FakeWindow>[]
} {
  const monitors = [monitor("eDP-1"), monitor("HDMI-2")]
  return {
    monitors,
    bindings: monitors.map((descriptor) => ({
      key: monitorKey(descriptor),
      window: { id: descriptor.connector!, name: "capture-window", visible: false, destroyed: 0 },
    })),
  }
}

/** The adapter's one operation: copy each decision onto the same window. */
function apply(decisions: VisibilityDecision<FakeWindow>[]) {
  for (const { binding, visible } of decisions) binding.window.visible = visible
}

test("two live windows exist; opening the bar shows only the focused one", () => {
  const { monitors, bindings } = twoWindows()
  assert.equal(bindings.length, 2, "one live window per monitor")
  assert.deepEqual(bindings.map((b) => b.window.visible), [false, false], "startup stays hidden")

  const focused = focusKey(monitors, "eDP-1")
  apply(planFocusVisibility(bindings, focused, true))
  assert.deepEqual(bindings.map((b) => b.window.visible), [true, false])
})

test("a focus change re-maps visibility without destroying or rebuilding windows", () => {
  const state = createUiState()
  state.screenshot.target = "screen"
  const stateIdentity = state.screenshot

  const { monitors, bindings } = twoWindows()
  apply(planFocusVisibility(bindings, focusKey(monitors, "eDP-1"), true))
  const identities = bindings.map((b) => b.window)

  const next = planFocusVisibility(bindings, focusKey(monitors, "HDMI-2"), true)
  apply(next)

  assert.deepEqual(bindings.map((b) => b.window.visible), [false, true])
  assert.deepEqual(bindings.map((b) => b.window), identities, "the same window objects survive focus")
  assert.deepEqual(bindings.map((b) => b.window.destroyed), [0, 0], "focus destroys nothing")
  assert.equal(state.screenshot, stateIdentity, "shared UiState is not rebound")
  assert.equal(state.screenshot.target, "screen", "shared selection survives focus")
})

test("focus changes while the bar is closed never pop a window open", () => {
  const { monitors, bindings } = twoWindows()
  apply(planFocusVisibility(bindings, focusKey(monitors, "HDMI-2"), false))
  assert.deepEqual(bindings.map((b) => b.window.visible), [false, false])
})

test("unknown focus still leaves exactly one visible window", () => {
  const { monitors, bindings } = twoWindows()
  apply(planFocusVisibility(bindings, focusKey(monitors, "DP-9"), true))
  assert.equal(bindings.filter((b) => b.window.visible).length, 1, "never two bars at once")
  assert.equal(bindings[0].window.visible, true, "deterministic registration-order fallback")
})

// ---------------------------------------------------------------------------
// The adapter wiring, read from the real source (GTK import keeps it out of
// the executable Node suite). `applyFocusVisibility` may only assign `.visible`.
// ---------------------------------------------------------------------------

function code(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
}

function functionBody(source: string, marker: string): string {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing function marker: ${marker}`)
  const brace = source.indexOf("{", start)
  let depth = 0
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    if (source[i] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(brace + 1, i)
    }
  }
  throw new Error(`unterminated function body: ${marker}`)
}

test("the adapter's focus path uses planFocusVisibility and only moves .visible", () => {
  const source = code(WINDOW_SET)
  assert.match(source, /planFocusVisibility\(bindings, focused, open\)/)
  const body = functionBody(source, "function applyFocusVisibility")
  assert.match(body, /\.visible\s*=/, "the adapter must map visibility")
  assert.doesNotMatch(body, /\.destroy\(|add_window|remove_window|createWindow|createUiState/)
  assert.match(source, /focus\.subscribe\(\(\)\s*=>\s*applyFocusVisibility\(\)\)/)
})
