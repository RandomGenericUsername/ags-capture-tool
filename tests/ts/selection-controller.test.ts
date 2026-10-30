// ---------------------------------------------------------------------------
// The shared overlay controller (REQ-003): one pending selection, Esc ladder,
// commit lock and INV-4 refresh survival — executed under plain Node because
// the controller has type-only platform imports.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import type { MonitorDescriptor } from "../../domain/monitor-registry.ts"
import type { ClientRect } from "../../domain/selection.ts"
import type { OverlayHost, OverlayView } from "../../ui/overlay/controller.ts"
import { createSelectionController } from "../../ui/overlay/controller.ts"

function monitor(connector: string): MonitorDescriptor {
  return {
    connector,
    model: connector,
    manufacturer: "",
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
  }
}

function harness(clients: ClientRect[] = []) {
  const monitors = [monitor("eDP-1"), monitor("HDMI-2")]
  let focused: string | null = "eDP-1"
  let listener: (() => void) | null = null
  const topology = {
    list: () => monitors.map((descriptor) => ({ descriptor, native: null })),
    subscribe: (onChange: () => void) => {
      listener = onChange
    },
  }
  const focus = {
    focusedConnector: () => focused,
    subscribe: () => {},
  }
  const controller = createSelectionController({
    topology,
    focus,
    clients: () => clients,
  })
  const views: OverlayView[] = []
  const visibility: boolean[] = []
  const host: OverlayHost = {
    connector: "eDP-1",
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
    setVisible: (visible) => visibility.push(visible),
    render: (view) => views.push(view),
  }
  controller.register(host)
  return {
    controller,
    host,
    views,
    visibility,
    setFocused: (next: string | null) => {
      focused = next
    },
    syncMonitors: () => listener?.(),
    last: () => views[views.length - 1],
  }
}

test("registering an overlay renders the inactive S0 state hidden", () => {
  const h = harness()
  assert.equal(h.last().active, false)
  assert.equal(h.visibility[0], false)
})

test("region mode shows only the hosting monitor, and the rect survives refresh", () => {
  const h = harness()
  h.controller.begin("screenshot", "region")
  assert.equal(h.last().active, true)
  assert.equal(h.last().target, "region")
  assert.equal(h.visibility.at(-1), true, "focused monitor hosts the region canvas")

  h.controller.setRect({ x: 10, y: 20, width: 100, height: 50 })
  assert.deepEqual(h.last().pending, {
    target: "region",
    rect: { x: 10, y: 20, width: 100, height: 50 },
  })

  // Palette refresh: re-render only. INV-4 says the pending selection survives.
  const before = h.controller.session()
  h.controller.refresh()
  assert.equal(h.controller.session(), before)
  assert.deepEqual(h.last().pending, {
    target: "region",
    rect: { x: 10, y: 20, width: 100, height: 50 },
  })
  assert.equal(h.controller.canCommit(), true)
})

test("region Esc clears the canvas, then closes the mode", () => {
  const h = harness()
  h.controller.begin("screenshot", "region")
  h.controller.setRect({ x: 1, y: 2, width: 30, height: 40 })
  assert.equal(h.controller.escape(), false)
  assert.deepEqual(h.last().pending, { target: "region", rect: null })
  assert.equal(h.controller.escape(), true)
})

test("window hover/pin uses client rects and the pin survives refresh", () => {
  const clients: ClientRect[] = [
    {
      address: "0xabc",
      title: "firefox",
      appClass: "firefox",
      monitor: "eDP-1",
      rect: { x: 100, y: 100, width: 500, height: 400 },
    },
  ]
  const h = harness(clients)
  h.controller.begin("screenshot", "window")
  h.controller.hoverAt(120, 120)
  assert.equal(h.last().hoverAddress, "0xabc")
  assert.equal(h.last().pinned, null, "hover alone never pins")
  assert.equal(h.controller.canCommit(), false, "hover alone never captures")

  h.controller.pinAt(120, 120)
  assert.equal(h.last().pinned?.address, "0xabc")
  assert.equal(h.controller.canCommit(), true)

  h.controller.refresh()
  assert.equal(h.last().pinned?.address, "0xabc", "INV-4: the pin survived the refresh")

  assert.equal(h.controller.escape(), false)
  assert.equal(h.last().pinned, null)
  assert.equal(h.controller.escape(), true)
})

test("clicking another client re-pins; clicking empty space keeps the pin", () => {
  const clients: ClientRect[] = [
    {
      address: "0xabc",
      title: "one",
      appClass: "one",
      monitor: "eDP-1",
      rect: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      address: "0xdef",
      title: "two",
      appClass: "two",
      monitor: "eDP-1",
      rect: { x: 200, y: 0, width: 100, height: 100 },
    },
  ]
  const h = harness(clients)
  h.controller.begin("screenshot", "window")
  h.controller.pinAt(50, 50)
  assert.equal(h.last().pinned?.address, "0xabc")
  h.controller.pinAt(250, 50)
  assert.equal(h.last().pinned?.address, "0xdef", "a second click re-pins")
  h.controller.pinAt(500, 500)
  assert.equal(h.last().pinned?.address, "0xdef", "empty space is not an unpin")
})

test("screen cycle swaps the monitor and Esc resets to the focused default", () => {
  const h = harness()
  h.controller.begin("screenshot", "screen")
  assert.equal(h.controller.monitorIndex("eDP-1"), 1)
  assert.equal(h.controller.monitorIndex("HDMI-2"), 2)
  h.controller.cycleMonitor()
  assert.deepEqual(h.last().pending, { target: "screen", monitor: "HDMI-2" })
  assert.equal(h.controller.escape(), false)
  assert.deepEqual(h.last().pending, { target: "screen", monitor: null })
  assert.equal(h.controller.escape(), true)
})

test("commit returns the finished selection, hides every overlay and locks", () => {
  const h = harness()
  h.controller.begin("recording", "region")
  h.controller.setRect({ x: 5, y: 6, width: 70, height: 80 })
  const selection = h.controller.commit()
  assert.deepEqual(selection, {
    kind: "region",
    geometry: { x: 5, y: 6, width: 70, height: 80 },
  })
  assert.equal(h.last().active, false)
  assert.equal(h.visibility.at(-1), false, "overlay hidden synchronously at commit")
  assert.equal(h.controller.selection(), null)
  h.controller.hideNow()
  assert.equal(h.last().active, false)
})

test("ending a mode hides the overlay and clears the pending object", () => {
  const h = harness()
  h.controller.begin("screenshot", "region")
  h.controller.setRect({ x: 1, y: 1, width: 10, height: 10 })
  h.controller.end()
  assert.equal(h.last().active, false)
  assert.deepEqual(h.last().pending, { target: "region", rect: null })
  assert.equal(h.visibility.at(-1), false)
})

test("retargeting re-engages the new target's empty pick", () => {
  const h = harness()
  h.controller.begin("screenshot", "region")
  h.controller.setRect({ x: 1, y: 1, width: 10, height: 10 })
  h.controller.retarget("screen")
  assert.equal(h.last().target, "screen")
  assert.deepEqual(h.last().pending, { target: "screen", monitor: null })
})

test("a focus change re-renders the hosting monitor selection", () => {
  const h = harness()
  h.controller.begin("screenshot", "region")
  assert.equal(h.last().focused, "eDP-1")
  h.setFocused("HDMI-2")
  h.controller.refresh()
  assert.equal(h.last().focused, "HDMI-2")
})

test("the monitor list follows topology changes without losing the session", () => {
  const h = harness()
  h.controller.begin("screenshot", "screen")
  h.controller.selectMonitor("HDMI-2")
  h.syncMonitors()
  assert.equal(h.controller.monitors().length, 2)
  assert.deepEqual(h.last().pending, { target: "screen", monitor: "HDMI-2" })
})

test("subscribers see selection changes and can unsubscribe", () => {
  const h = harness()
  let calls = 0
  const off = h.controller.subscribe(() => {
    calls += 1
  })
  h.controller.begin("screenshot", "region")
  h.controller.setRect({ x: 1, y: 2, width: 3, height: 4 })
  assert.ok(calls >= 2)
  off()
  const before = calls
  h.controller.end()
  assert.equal(calls, before, "destroyed bar no longer receives selection updates")
})
