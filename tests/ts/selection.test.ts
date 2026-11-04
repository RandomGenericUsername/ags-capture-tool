// ---------------------------------------------------------------------------
// Pure geometry tests for the pending-selection overlay (REQ-003 §4).
//
// These execute the exact functions the GTK overlay calls on pointer events,
// including negative monitor origins and a scale≠1-shaped logical rect. They do
// not construct GTK: the point is to pin the coordinate/clamp rules that the
// backend receives, not the widget tree.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  badgeAnchor,
  canonicalGeometry,
  clampRect,
  clientByAddress,
  containsPoint,
  handlePositions,
  hitClient,
  hitHandle,
  intersectRect,
  localToGlobal,
  globalToLocal,
  moveRect,
  normalizeRect,
  rectFromPoints,
  regionBadge,
  regionPressAt,
  resizeRect,
  windowBadge,
  type ClientRect,
  type Rect,
} from "../../domain/selection.ts"

const LEFT: Rect = { x: -1920, y: 0, width: 1920, height: 1080 }
const RIGHT: Rect = { x: 0, y: 0, width: 2560, height: 1440 }

test("normalizeRect rounds and gives a positive size", () => {
  assert.deepEqual(normalizeRect({ x: 10.4, y: 9.6, width: 0, height: -3 }), {
    x: 10,
    y: 10,
    width: 1,
    height: 1,
  })
})

test("rectFromPoints normalises a reverse drag", () => {
  assert.deepEqual(rectFromPoints(300, 200, 100, 50), {
    x: 100,
    y: 50,
    width: 200,
    height: 150,
  })
})

test("canonicalGeometry is the backend's 'X,Y WxH', including negatives", () => {
  assert.equal(canonicalGeometry({ x: 0, y: 48, width: 920, height: 470 }), "0,48 920x470")
  assert.equal(
    canonicalGeometry({ x: -1919, y: -20, width: 800, height: 600 }),
    "-1919,-20 800x600",
  )
  assert.equal(
    canonicalGeometry({ x: 1.4, y: 2.6, width: 10.2, height: 20.8 }),
    "1,3 10x21",
  )
})

test("a region is clamped to its hosting monitor, including negative origins", () => {
  assert.deepEqual(clampRect({ x: -2000, y: -50, width: 300, height: 200 }, LEFT), {
    x: -1920,
    y: 0,
    width: 300,
    height: 200,
  })
  assert.deepEqual(clampRect({ x: 1800, y: 1000, width: 400, height: 300 }, LEFT), {
    x: -400,
    y: 780,
    width: 400,
    height: 300,
  })
  // A rect entirely beyond the right edge is shifted back inside at full size,
  // never left with a negative width or a 1px sliver.
  const past = clampRect({ x: 9000, y: 9000, width: 100, height: 100 }, RIGHT)
  assert.equal(past.width, 100)
  assert.equal(past.height, 100)
  assert.equal(past.x + past.width, RIGHT.width)
  assert.equal(past.y + past.height, RIGHT.height)
  // Larger than the monitor: cap the size, then pin to the origin.
  assert.deepEqual(clampRect({ x: 50, y: 50, width: 9999, height: 9999 }, RIGHT), {
    x: 0,
    y: 0,
    width: 2560,
    height: 1440,
  })
})

test("moveRect translates inside the monitor and stops at the edges", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 }
  assert.deepEqual(moveRect(start, 50, 25, RIGHT), {
    x: 150,
    y: 125,
    width: 200,
    height: 100,
  })
  const pinned = moveRect(start, -1000, -1000, RIGHT)
  assert.equal(pinned.x, 0)
  assert.equal(pinned.y, 0)
})

test("resizeRect grows and shrinks from the named handle, never inverted", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 }
  assert.deepEqual(resizeRect(start, "se", 40, 20, RIGHT), {
    x: 100,
    y: 100,
    width: 240,
    height: 120,
  })
  assert.deepEqual(resizeRect(start, "nw", 40, 20, RIGHT), {
    x: 140,
    y: 120,
    width: 160,
    height: 80,
  })
  const collapsed = resizeRect(start, "se", -999, -999, RIGHT)
  assert.equal(collapsed.width, 1)
  assert.equal(collapsed.height, 1)
  assert.equal(collapsed.x, 100)
  assert.equal(collapsed.y, 100)
})

test("the eight handle widgets sit at the mockup corners and edge midpoints", () => {
  const rect = { x: 100, y: 200, width: 300, height: 100 }
  const positions = handlePositions(rect)
  assert.equal(positions.length, 8)
  assert.deepEqual(
    positions.map((entry) => entry.handle),
    ["nw", "ne", "se", "sw", "n", "e", "s", "w"],
  )
  const nw = positions[0]
  assert.deepEqual({ x: nw.x, y: nw.y }, { x: 96, y: 196 }, "9px handle centred on the corner")
})

test("hitHandle prefers the corner, then the edge, and ignores the interior", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 }
  assert.equal(hitHandle(rect, 100, 100), "nw")
  assert.equal(hitHandle(rect, 300, 150), "e")
  assert.equal(hitHandle(rect, 200, 100), "n")
  assert.equal(hitHandle(rect, 200, 150), null)
})

test("a minimal region keeps a centre move zone while its corners still resize", () => {
  // 15×15 is the live repro (BUG-002): a fixed 9px hit radius made every point
  // a handle. The clamped radius leaves the centre outside all eight handles.
  const minimal = { x: 100, y: 100, width: 15, height: 15 }
  const centre = { x: 107, y: 107 }
  assert.equal(hitHandle(minimal, centre.x, centre.y), null)
  assert.deepEqual(regionPressAt(minimal, centre.x, centre.y), { kind: "move" })
  assert.deepEqual(regionPressAt(minimal, 100, 100), {
    kind: "resize",
    handle: "nw",
  })
  assert.deepEqual(regionPressAt(minimal, 115, 107), {
    kind: "resize",
    handle: "e",
  })
})

test("a normal region still moves from its centre and resizes from corner/edge", () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 }
  assert.deepEqual(regionPressAt(rect, 200, 150), { kind: "move" })
  assert.deepEqual(regionPressAt(rect, 100, 100), {
    kind: "resize",
    handle: "nw",
  })
  assert.deepEqual(regionPressAt(rect, 300, 150), {
    kind: "resize",
    handle: "e",
  })
  assert.equal(regionPressAt(rect, 900, 900), null, "outside starts a fresh draw")
})

test("containsPoint and intersectRect agree on edges", () => {
  const rect = { x: 10, y: 20, width: 100, height: 50 }
  assert.equal(containsPoint(rect, 10, 20), true)
  assert.equal(containsPoint(rect, 110, 70), false, "the far edge is exclusive")
  assert.deepEqual(intersectRect(rect, { x: 50, y: 30, width: 100, height: 100 }), {
    x: 50,
    y: 30,
    width: 60,
    height: 40,
  })
  assert.equal(intersectRect(rect, { x: 200, y: 200, width: 10, height: 10 }), null)
})

test("client hit-testing and address lookup survive a vanished client", () => {
  const clients: ClientRect[] = [
    {
      address: "0xabc",
      title: "firefox",
      appClass: "firefox",
      monitor: "eDP-1",
      rect: { x: 50, y: 60, width: 800, height: 600 },
    },
  ]
  assert.equal(hitClient(clients, 100, 100)?.address, "0xabc")
  assert.equal(hitClient(clients, 10, 10), null)
  assert.equal(clientByAddress(clients, "0xABC")?.title, "firefox")
  assert.equal(clientByAddress(clients, "0xdead"), null)
})

test("badgeAnchor flips below when there is no room above", () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 800 }
  const below = badgeAnchor({ x: 100, y: 10, width: 200, height: 100 }, bounds, 180, 24)
  assert.equal(below.y, 120)
  const above = badgeAnchor({ x: 100, y: 300, width: 200, height: 100 }, bounds, 180, 24)
  assert.equal(above.y, 266)
  assert.ok(above.x >= 8 && above.x <= 812)
})

test("badge text names the size and the pending state", () => {
  assert.equal(regionBadge(null), "drag to select a region")
  assert.equal(regionBadge({ x: 0, y: 0, width: 920, height: 470 }), "920×470 · editable")
  const client: ClientRect = {
    address: "0x1",
    title: "firefox — dotfiles",
    appClass: "firefox",
    monitor: "eDP-1",
    rect: { x: 0, y: 0, width: 1280, height: 800 },
  }
  assert.match(windowBadge(client, false), /firefox — dotfiles — 1280×800 · click once to pin/)
  assert.match(windowBadge(client, true), /pinned/)
  assert.equal(windowBadge(null, false), "hover a window · click to pin")
})

test("overlay local<->global translation keeps negative monitor origins exact", () => {
  // A monitor left of the primary has a negative logical origin. The overlay's
  // widget-local (0,0) is that origin, and a point drawn there is committed as
  // the negative global coordinate the backend/grim expect.
  assert.deepEqual(localToGlobal(0, 0, LEFT), { x: -1920, y: 0 })
  assert.deepEqual(localToGlobal(100, 50, LEFT), { x: -1820, y: 50 })
  assert.deepEqual(globalToLocal(-1820, 50, LEFT), { x: 100, y: 50 })

  // A scale≠1 output still reports LOGICAL geometry (GDK/hyprctl/slurp agree on
  // that space); the translation is not a scale. Actual equality of grim/slurp
  // coordinates on a scale≠1 output is recorded as UNMEASURED in the ticket:
  // this host has one scale=1 output.
  const logicalAtScaleTwo: Rect = { x: 0, y: 0, width: 1280, height: 720 }
  assert.deepEqual(
    clampRect({ x: localToGlobal(1280, 0, logicalAtScaleTwo).x, y: 0, width: 10, height: 10 }, logicalAtScaleTwo),
    { x: 1270, y: 0, width: 10, height: 10 },
  )
})
