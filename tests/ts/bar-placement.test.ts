// ---------------------------------------------------------------------------
// Placement arithmetic tests (REQ-002, design.md D3/§11.4).
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import { barMarginTop } from "../../domain/bar-placement.ts"

test("bottom placement never takes a top margin", () => {
  assert.equal(barMarginTop("bottom", 48, 0), 0)
  assert.equal(barMarginTop("bottom", 48, 100), 0)
})

test("top placement is reserved_top + offsetPx", () => {
  // The reference host: ags-bar reserves 48px at the top.
  assert.equal(barMarginTop("top", 48, 0), 48)
  assert.equal(barMarginTop("top", 48, 12), 60)
  assert.equal(barMarginTop("top", 0, 5), 5)
})

test("corrupt reserved/offset values degrade to 0 instead of NaN", () => {
  for (const bad of [NaN, Infinity, -Infinity, -48, -1]) {
    assert.equal(barMarginTop("top", bad, 0), 0, `reserved ${bad}`)
    assert.equal(barMarginTop("top", 48, bad), 48, `offset ${bad}`)
  }
})

test("fractional pixels are truncated to whole pixels", () => {
  assert.equal(barMarginTop("top", 48.9, 0.8), 48)
})
