// ---------------------------------------------------------------------------
// REQ-003 commit flags in the ONE request→argv translator.
//
// Legacy arrays must stay byte-identical when no selection is present (already
// pinned by `domain-cli-args.test.ts`). These cases pin the ADDITIVE half:
// exactly one flag pair per selection kind, appended at the END.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

const PROGRAM = "capture-tool"

import { recordingArgs, screenshotArgs, selectionArgs } from "../../domain/cli-args.ts"
import type { RecordingRequest, ScreenshotRequest } from "../../domain/capture-request.ts"
import type { Selection } from "../../domain/selection.ts"

function shot(selection?: Selection): ScreenshotRequest {
  return {
    target: "region",
    delay: 0,
    format: "png",
    save: false,
    cursor: false,
    ...(selection ? { selection } : {}),
  }
}

function rec(selection?: Selection): RecordingRequest {
  return {
    target: "region",
    fps: 60,
    gifFps: 15,
    format: "mp4",
    audio: "system",
    quality: "high",
    duration: 0,
    size: "original",
    cursor: false,
    ...(selection ? { selection } : {}),
  }
}

const REGION: Selection = { kind: "region", geometry: { x: 10, y: 20, width: 300, height: 200 } }
const WINDOW: Selection = { kind: "window", address: "0x55abc" }
const SCREEN: Selection = { kind: "screen", monitor: "DP-2" }

test("selectionArgs emits exactly the design.md §11.3 flag", () => {
  assert.deepEqual(selectionArgs(REGION), ["--geometry", "10,20 300x200"])
  assert.deepEqual(selectionArgs(WINDOW), ["--window", "0x55abc"])
  assert.deepEqual(selectionArgs(SCREEN), ["--monitor", "DP-2"])
})

test("region geometry is canonical, never WxH+X+Y", () => {
  const argv = screenshotArgs({ ...shot(REGION), target: "region" })
  const token = argv[argv.indexOf("--geometry") + 1]
  assert.equal(token, "10,20 300x200")
  assert.doesNotMatch(token, /\+/)
})

test("screenshot argv appends the selection after every legacy flag", () => {
  assert.deepEqual(screenshotArgs(shot(REGION)), [
    PROGRAM,
    "screenshot",
    "--target",
    "region",
    "--delay",
    "0",
    "--format",
    "png",
    "--geometry",
    "10,20 300x200",
  ])
  assert.deepEqual(screenshotArgs({ ...shot(WINDOW), target: "window", save: true, cursor: true }), [
    PROGRAM,
    "screenshot",
    "--target",
    "window",
    "--delay",
    "0",
    "--format",
    "png",
    "--save",
    "--cursor",
    "--window",
    "0x55abc",
  ])
  assert.deepEqual(screenshotArgs({ ...shot(SCREEN), target: "screen" }), [
    PROGRAM,
    "screenshot",
    "--target",
    "screen",
    "--delay",
    "0",
    "--format",
    "png",
    "--monitor",
    "DP-2",
  ])
})

test("recording argv appends the selection after --cursor / --size", () => {
  assert.deepEqual(recordingArgs({ ...rec(REGION), cursor: true }), [
    PROGRAM,
    "start",
    "--target",
    "region",
    "--fps",
    "60",
    "--format",
    "mp4",
    "--quality",
    "high",
    "--audio",
    "system",
    "--duration",
    "0",
    "--cursor",
    "--geometry",
    "10,20 300x200",
  ])
  assert.deepEqual(recordingArgs({ ...rec(WINDOW), target: "window" }).slice(-2), [
    "--window",
    "0x55abc",
  ])
  assert.deepEqual(recordingArgs({ ...rec(SCREEN), target: "screen" }).slice(-2), [
    "--monitor",
    "DP-2",
  ])
  const gif = recordingArgs({ ...rec(REGION), format: "gif", size: "50%", cursor: true })
  assert.deepEqual(gif.slice(-5), [
    "--size",
    "50",
    "--cursor",
    "--geometry",
    "10,20 300x200",
  ])
})

test("no selection means no new flag (legacy argv unchanged)", () => {
  for (const argv of [screenshotArgs(shot()), recordingArgs(rec())]) {
    assert.equal(argv.includes("--geometry"), false)
    assert.equal(argv.includes("--window"), false)
    assert.equal(argv.includes("--monitor"), false)
  }
})
