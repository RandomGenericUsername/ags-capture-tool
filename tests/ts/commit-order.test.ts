// ---------------------------------------------------------------------------
// FR-10: the overlay/dim must be hidden BEFORE the backend starts capturing.
//
// Executes the exact helper the commit path uses. The failure this pins is
// silent: a dim rectangle baked into the first recorded frame, or a screenshot
// that contains its own selection UI. Order is the whole assertion.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import { runCommit } from "../../lib/commit-order.ts"

test("commit hides the overlay, then the bar, then launches the backend", () => {
  const calls: string[] = []
  const state = { overlayVisible: true, barVisible: true }

  runCommit({
    hideOverlay: () => {
      assert.equal(state.overlayVisible, true)
      state.overlayVisible = false
      calls.push("hide-overlay")
    },
    hideBar: () => {
      state.barVisible = false
      calls.push("hide-bar")
    },
    launch: () => {
      assert.equal(state.overlayVisible, false, "backend launched while overlay was visible")
      assert.equal(state.barVisible, false, "backend launched while bar was visible")
      calls.push("launch")
    },
  })

  assert.deepEqual(calls, ["hide-overlay", "hide-bar", "launch"])
})

test("the sequence is synchronous: launch observes both hides immediately", () => {
  let phase = "start"
  runCommit({
    hideOverlay: () => {
      phase = "overlay-hidden"
    },
    hideBar: () => {
      phase = "bar-hidden"
    },
    launch: () => {
      assert.equal(phase, "bar-hidden")
    },
  })
  assert.equal(phase, "bar-hidden")
})

test("a thrown launch does not reorder or resurrect the hides", () => {
  const calls: string[] = []
  assert.throws(
    () =>
      runCommit({
        hideOverlay: () => calls.push("hide-overlay"),
        hideBar: () => calls.push("hide-bar"),
        launch: () => {
          calls.push("launch")
          throw new Error("spawn failed")
        },
      }),
    /spawn failed/,
  )
  assert.deepEqual(calls, ["hide-overlay", "hide-bar", "launch"])
})
