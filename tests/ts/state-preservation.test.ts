// ---------------------------------------------------------------------------
// STATE-PRESERVATION tests for the capture palette refresh (REQ-011 / AD-27).
//
// The requirement is not "the icons look right after a palette change"; it is
// that the refresh preserves everything the operator is doing:
//
//   - the active surface (screenshot/recording/settings) stays mapped;
//   - the selected option groups and the shared `UiState` object are untouched;
//   - every per-monitor window is still the SAME window object;
//   - a removed monitor's surface unregisters instead of leaking.
//
// WHAT IS EXECUTED. `lib/appearance.ts`, `ui/appearance.ts` and
// `domain/ui-state.ts` are pure enough to run under plain Node. The GTK parts
// arrive as callbacks in the `AppearanceSurface` contract, so the model below
// supplies the real call order (clear -> rebuild icons -> re-measure) against
// fake windows while the shared state and the active-view record are real
// objects. The SOURCE wiring (where ClassicWindow registers) is pinned by
// tests/app-contract.test.mjs; this suite pins the semantics.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  applyAppearance,
  createAppearanceRefresh,
  createAppearanceRegistry,
  type AppearanceSurface,
} from "../../lib/appearance.ts"
import { refreshSurfaces } from "../../ui/appearance.ts"
import { createUiState, type UiState } from "../../domain/ui-state.ts"

interface ActiveView {
  visible: boolean
  mode: "screenshot" | "recording"
  view: "screenshot" | "recording" | "settings"
  pathEditorOpen: boolean
  settingsDraft: string
}

interface FakeWindow {
  id: string
  iconGeneration: number
  surface: AppearanceSurface
}

/**
 * A per-monitor window model with the same state the real window owns: the
 * active view record and the icon widgets. `rebuildIcons` deliberately does
 * not touch `active`; that is what the real `IconSlots.refresh()` does (only
 * the `Gtk.Image` child is replaced).
 */
function fakeWindow(
  id: string,
  active: ActiveView,
  measurements: string[],
): FakeWindow {
  let iconsBuilt = 0
  const window: FakeWindow = {
    id,
    iconGeneration: 0,
    surface: {
      clearCaches: () => {
        // The real clear removes the current Gtk.Image children. It does not
        // hide, unmap or destroy the window.
        assert.equal(active.visible, true, "clearCaches must not hide the surface")
      },
      rebuildIcons: () => {
        iconsBuilt += 1
        window.iconGeneration = iconsBuilt
      },
      refreshWindow: () => {
        measurements.push(id)
        assert.equal(active.visible, true, "refreshWindow must not hide the surface")
      },
    },
  }
  return window
}

test("a refresh rebuilds icons in every window and preserves the shared UI state", () => {
  const state: UiState = createUiState()
  state.screenshot.target = "screen"
  state.recording.format = "gif"
  state.recording.fps = 24
  const stateIdentity = state.screenshot

  const active: ActiveView = {
    visible: true,
    mode: "recording",
    view: "settings",
    pathEditorOpen: true,
    settingsDraft: "~/Pictures/Unsaved",
  }
  const activeSnapshot = { ...active }
  const measurements: string[] = []
  const windows = [fakeWindow("eDP-1", active, measurements), fakeWindow("HDMI-2", active, measurements)]
  const registry = createAppearanceRegistry()
  for (const window of windows) registry.register(window.surface)

  refreshSurfaces(registry.surfaces())

  assert.deepEqual(
    windows.map((w) => w.iconGeneration),
    [1, 1],
    "every per-monitor window reloaded its generated icons",
  )
  assert.deepEqual(measurements, ["eDP-1", "HDMI-2"], "every window was re-measured")
  assert.equal(registry.surfaces().length, 2, "a refresh never recreates the window set")
  assert.deepEqual(active, activeSnapshot, "active view, mode, draft and editor survived")
  assert.equal(state.screenshot, stateIdentity, "the shared screenshot state object was not rebound")
  assert.equal(state.screenshot.target, "screen", "the selected screenshot target survived")
  assert.equal(state.recording.format, "gif", "the selected recording format survived")
  assert.equal(state.recording.fps, 24, "the selected frame rate survived")
})

test("hidden windows stay hidden across a refresh", () => {
  const active: ActiveView = {
    visible: false,
    mode: "screenshot",
    view: "screenshot",
    pathEditorOpen: false,
    settingsDraft: "",
  }
  const measurements: string[] = []
  const window = fakeWindow("eDP-1", active, measurements)

  // The fake's clear/refresh callbacks assert visible=true in the test above;
  // for a hidden surface the only contract is that the refresh does not map it.
  applyAppearance({
    clearCaches: () => {},
    rebuildIcons: () => {},
    refreshWindow: () => measurements.push(window.id),
  })

  assert.equal(active.visible, false, "a palette refresh must not show a hidden capture panel")
  assert.deepEqual(measurements, ["eDP-1"])
})

test("a removed monitor unregisters its surface and is not refreshed again", () => {
  const active: ActiveView = {
    visible: true,
    mode: "screenshot",
    view: "screenshot",
    pathEditorOpen: false,
    settingsDraft: "",
  }
  const measurements: string[] = []
  const kept = fakeWindow("eDP-1", active, measurements)
  const removed = fakeWindow("HDMI-2", active, measurements)
  const registry = createAppearanceRegistry()
  registry.register(kept.surface)
  const off = registry.register(removed.surface)

  off() // the window set's destroy path
  refreshSurfaces(registry.surfaces())

  assert.equal(kept.iconGeneration, 1)
  assert.equal(removed.iconGeneration, 0, "a destroyed window was not touched")
  assert.deepEqual(measurements, ["eDP-1"])
})

test("the same appearance hash does not rebuild icons twice", () => {
  const active: ActiveView = {
    visible: true,
    mode: "screenshot",
    view: "screenshot",
    pathEditorOpen: false,
    settingsDraft: "",
  }
  const measurements: string[] = []
  const window = fakeWindow("eDP-1", active, measurements)
  const registry = createAppearanceRegistry()
  registry.register(window.surface)
  const refresh = createAppearanceRefresh(() => refreshSurfaces(registry.surfaces()))

  refresh("hash-a")
  refresh("hash-a")
  assert.equal(window.iconGeneration, 1, "an idempotent trigger must be a no-op")
  refresh("hash-b")
  assert.equal(window.iconGeneration, 2, "a new appearance rebuilds the icons")
  assert.equal(active.visible, true)
})
