import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_RECORDING_CONTROLS,
  RECORDING_CONTROLS_MODES,
  isRecordingControlsMode,
  migrateRecordingHud,
  recordingSurfaces,
  resolveRecordingControls,
} from "../../domain/recording-presentation.ts"

test("the default presentation is the top bar", () => {
  assert.equal(DEFAULT_RECORDING_CONTROLS, "top-bar")
  assert.deepEqual(RECORDING_CONTROLS_MODES, ["top-bar", "hover", "always"])
})

test("each mode chooses exactly one automatic surface", () => {
  assert.deepEqual(recordingSurfaces("top-bar"), {
    topBar: true,
    captureBar: "hidden",
    allowLauncherHud: false,
    compactAllowed: true,
  })
  assert.deepEqual(recordingSurfaces("hover"), {
    topBar: false,
    captureBar: "hover",
    allowLauncherHud: false,
    compactAllowed: false,
  })
  assert.deepEqual(recordingSurfaces("always"), {
    topBar: false,
    captureBar: "always",
    allowLauncherHud: false,
    compactAllowed: true,
  })

  for (const mode of RECORDING_CONTROLS_MODES) {
    const surfaces = recordingSurfaces(mode)
    const automatic = [surfaces.topBar, surfaces.captureBar !== "hidden"].filter(Boolean)
    assert.equal(automatic.length, 1, `${mode} must not light two surfaces`)
  }
})

test("the old recording_hud values migrate without adding a second surface", () => {
  assert.equal(migrateRecordingHud("hidden"), "top-bar")
  assert.equal(migrateRecordingHud("hover"), "hover")
  assert.equal(migrateRecordingHud("always"), "always")
  assert.equal(migrateRecordingHud("sometimes"), "top-bar")
  assert.equal(migrateRecordingHud(undefined), "top-bar")
})

test("the new key wins over the legacy key", () => {
  assert.equal(resolveRecordingControls("hover", "hidden"), "hover")
  assert.equal(resolveRecordingControls("always", "hover"), "always")
  assert.equal(resolveRecordingControls("top-bar", "always"), "top-bar")
  assert.equal(resolveRecordingControls("bad", "hover"), "hover")
  assert.equal(resolveRecordingControls(undefined, "hidden"), "top-bar")
  assert.equal(resolveRecordingControls(undefined, undefined), "top-bar")
})

test("the mode guard rejects values that are not in the closed set", () => {
  assert.equal(isRecordingControlsMode("top-bar"), true)
  assert.equal(isRecordingControlsMode("hidden"), false)
  assert.equal(isRecordingControlsMode(null), false)
  assert.equal(isRecordingControlsMode(1), false)
})
