// ---------------------------------------------------------------------------
// Pending-selection state machine + Esc ladder (REQ-003, design.md §3/§4.7).
//
// Executed without GTK. Each rung is one press; region/window need a gesture
// first, screen defaults to the focused monitor; commit locks the session and
// no mutator can edit after it (D6 one-way door).
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  beginSelection,
  canCommit,
  clearPending,
  commitSelection,
  emptySelection,
  retargetSelection,
  selectionOf,
  setPinnedWindow,
  setRegionRect,
  setScreenMonitor,
} from "../../domain/selection-session.ts"

const FOCUSED = "eDP-1"

test("opening a mode engages an empty pending pick immediately (FR-4)", () => {
  const region = beginSelection("region")
  assert.equal(region.active, true)
  assert.deepEqual(region.pending, { target: "region", rect: null })
  assert.equal(canCommit(region, FOCUSED), false, "an empty canvas is not a capture")

  const window = beginSelection("window")
  assert.deepEqual(window.pending, { target: "window", address: null })
  assert.equal(canCommit(window, FOCUSED), false, "hover alone is not a pick")
})

test("screen defaults to the focused monitor and follows focus while unpicked", () => {
  const screen = beginSelection("screen")
  assert.deepEqual(screen.pending, { target: "screen", monitor: null })
  assert.deepEqual(selectionOf(screen, FOCUSED), { kind: "screen", monitor: FOCUSED })
  assert.deepEqual(selectionOf(screen, "HDMI-2"), { kind: "screen", monitor: "HDMI-2" })
  assert.equal(canCommit(screen, FOCUSED), true)
})

test("region Esc: clear the rect, keep the mode, then close on the next press", () => {
  const empty = beginSelection("region")
  const first = clearPending(empty, FOCUSED)
  assert.deepEqual(first, { session: empty, closed: true }, "empty canvas has rung (a) nothing to clear")

  const drawn = setRegionRect(empty, { x: 10, y: 20, width: 300, height: 200 })
  const cleared = clearPending(drawn, FOCUSED)
  assert.equal(cleared.closed, false, "the first Esc clears the rect and stays in the mode")
  assert.deepEqual(cleared.session.pending, { target: "region", rect: null })
  assert.equal(cleared.session.active, true)

  const second = clearPending(cleared.session, FOCUSED)
  assert.equal(second.closed, true, "the next Esc closes the mode")
})

test("window Esc unpins first, then closes on the next press", () => {
  const pinned = setPinnedWindow(beginSelection("window"), "0xabc")
  assert.deepEqual(selectionOf(pinned, FOCUSED), { kind: "window", address: "0xabc" })

  const unpinned = clearPending(pinned, FOCUSED)
  assert.equal(unpinned.closed, false)
  assert.deepEqual(unpinned.session.pending, { target: "window", address: null })
  assert.equal(unpinned.session.active, true)

  assert.equal(clearPending(unpinned.session, FOCUSED).closed, true)
})

test("screen Esc returns to the focused monitor first, then closes", () => {
  const swapped = setScreenMonitor(beginSelection("screen"), "HDMI-2", FOCUSED)
  assert.deepEqual(swapped.pending, { target: "screen", monitor: "HDMI-2" })

  const reset = clearPending(swapped, FOCUSED)
  assert.equal(reset.closed, false)
  assert.deepEqual(reset.session.pending, { target: "screen", monitor: null })
  assert.equal(clearPending(reset.session, FOCUSED).closed, true)
})

test("picking the already-focused monitor is stored as the default", () => {
  const picked = setScreenMonitor(beginSelection("screen"), FOCUSED, FOCUSED)
  assert.deepEqual(picked.pending, { target: "screen", monitor: null })
  assert.equal(clearPending(picked, FOCUSED).closed, true)
})

test("commit snapshots the exact selection and locks the session (D6)", () => {
  const region = setRegionRect(beginSelection("region"), { x: 1, y: 2, width: 30, height: 40 })
  const committed = commitSelection(region, FOCUSED)
  assert.deepEqual(committed.selection, {
    kind: "region",
    geometry: { x: 1, y: 2, width: 30, height: 40 },
  })
  assert.equal(committed.session.active, false)
  assert.equal(canCommit(committed.session, FOCUSED), false)
})

test("no post-commit transition can edit the captured selection", () => {
  const committed = commitSelection(
    setPinnedWindow(beginSelection("window"), "0xabc"),
    FOCUSED,
  ).session
  assert.equal(committed.active, false)

  const retargeted = retargetSelection(committed, "region")
  assert.equal(retargeted, committed, "target pills cannot resurrect a session")
  assert.equal(setRegionRect(committed, { x: 9, y: 9, width: 9, height: 9 }), committed)
  assert.equal(setPinnedWindow(committed, "0xdef"), committed)
  assert.equal(setScreenMonitor(committed, "HDMI-2", FOCUSED), committed)
  assert.deepEqual(clearPending(committed, FOCUSED), { session: committed, closed: true })
  assert.equal(selectionOf(committed, FOCUSED), null)
})

test("a non-committable session commits nothing and stays as it was", () => {
  const empty = beginSelection("region")
  const result = commitSelection(empty, FOCUSED)
  assert.equal(result.selection, null)
  assert.equal(result.session, empty, "nothing was locked because nothing was captured")
  assert.equal(canCommit(result.session, FOCUSED), false)
})

test("retargeting an open mode starts that target's empty pick", () => {
  const region = setRegionRect(beginSelection("region"), { x: 1, y: 2, width: 3, height: 4 })
  const window = retargetSelection(region, "window")
  assert.equal(window.active, true)
  assert.deepEqual(window.pending, { target: "window", address: null })
  assert.equal(window.target, "window")

  assert.equal(emptySelection().active, false)
})
