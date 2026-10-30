// ---------------------------------------------------------------------------
// S0/S1 surface-machine tests (REQ-002, design.md §3/§5).
//
// The window renders this pure state; these tests pin the transitions the
// acceptance checklist names: open a lane, switch lanes without going home,
// back/Esc one level, and settings from S0 only (INV-3).
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  back,
  enterAction,
  homeBar,
  isModeOpen,
  isSettingsOpen,
  openMode,
  openSettings,
} from "../../domain/bar-state.ts"

test("first run is S0 home on the screenshot lane", () => {
  const state = homeBar()
  assert.deepEqual(state, { view: "home", mode: "screenshot" })
  assert.equal(isModeOpen(state), false)
  assert.equal(isSettingsOpen(state), false)
})

test("homeBar returns a fresh object, never a shared mutable constant", () => {
  const a = homeBar()
  const b = homeBar()
  a.view = "recording"
  assert.equal(b.view, "home")
})

test("S0 -> S1(screenshot) and S0 -> S1(recording)", () => {
  const screenshot = openMode(homeBar(), "screenshot")
  assert.deepEqual(screenshot, { view: "screenshot", mode: "screenshot" })
  assert.equal(isModeOpen(screenshot), true)

  const recording = openMode(homeBar(), "recording")
  assert.deepEqual(recording, { view: "recording", mode: "recording" })
})

test("the other mode icon switches lanes without returning home", () => {
  const recording = openMode(openMode(homeBar(), "screenshot"), "recording")
  assert.equal(recording.view, "recording")
  assert.equal(recording.mode, "recording")

  const screenshot = openMode(recording, "screenshot")
  assert.equal(screenshot.view, "screenshot")
  assert.equal(screenshot.mode, "screenshot")
})

test("back/Esc returns S1 to S0, one level, and keeps the last lane", () => {
  const home = back(openMode(homeBar(), "recording"))
  assert.equal(home.view, "home")
  assert.equal(home.mode, "recording", "the rail remembers the last lane")
  assert.equal(isModeOpen(home), false)
})

test("back from home is a no-op (no second, hidden level)", () => {
  assert.deepEqual(back(homeBar()), homeBar())
})

test("settings opens from S0 only (INV-3)", () => {
  const settings = openSettings(homeBar())
  assert.equal(settings.view, "settings")
  assert.equal(isSettingsOpen(settings), true)

  const fromScreenshot = openSettings(openMode(homeBar(), "screenshot"))
  assert.equal(fromScreenshot.view, "screenshot", "no settings entry from S1")

  const fromRecording = openSettings(openMode(homeBar(), "recording"))
  assert.equal(fromRecording.view, "recording", "no settings entry from S1")

  assert.equal(openSettings(settings).view, "settings", "already open stays open")
})

test("back from settings returns S0", () => {
  assert.deepEqual(back(openSettings(homeBar())), homeBar())
})

test("Enter is the CTA twin in S1 and never commits from S0", () => {
  assert.equal(enterAction(homeBar()), null)
  assert.equal(enterAction(openMode(homeBar(), "screenshot")), "screenshot")
  assert.equal(enterAction(openMode(homeBar(), "recording")), "recording")
  assert.equal(enterAction(openSettings(homeBar())), "settings")
})
