// ---------------------------------------------------------------------------
// `hyprctl -j monitors` reserved-top fallback tests (REQ-002, design.md §11.4).
//
// The payload shape is copied from this host: reserved is
// [left, top, right, bottom], and ags-bar's top zone is 48.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import { reservedTopFromHyprctl } from "../../domain/monitor-reserved.ts"

const PAYLOAD = JSON.stringify([
  {
    name: "eDP-1",
    focused: true,
    reserved: [0, 48, 0, 0],
  },
  {
    name: "HDMI-2",
    focused: false,
    reserved: [0, 0, 0, 0],
  },
])

test("the named monitor's top reserved zone is read from index 1", () => {
  assert.equal(reservedTopFromHyprctl(PAYLOAD, "eDP-1"), 48)
  assert.equal(reservedTopFromHyprctl(PAYLOAD, "HDMI-2"), 0)
})

test("a missing connector falls back to the focused monitor, then the first", () => {
  assert.equal(reservedTopFromHyprctl(PAYLOAD, null), 48)
  assert.equal(reservedTopFromHyprctl(PAYLOAD, "DP-9"), 48)
})

test("corrupt payloads are unknown, never a silent zero", () => {
  for (const raw of [
    "",
    "not json",
    "{}",
    "[]",
    JSON.stringify([{ name: "eDP-1" }]),
    JSON.stringify([{ name: "eDP-1", reserved: [] }]),
    JSON.stringify([{ name: "eDP-1", reserved: [0, "48", 0, 0] }]),
  ]) {
    assert.equal(reservedTopFromHyprctl(raw, "eDP-1"), null, raw)
  }
})

test("negative reserved values are clamped to zero", () => {
  const raw = JSON.stringify([{ name: "eDP-1", reserved: [0, -5, 0, 0] }])
  assert.equal(reservedTopFromHyprctl(raw, "eDP-1"), 0)
})
