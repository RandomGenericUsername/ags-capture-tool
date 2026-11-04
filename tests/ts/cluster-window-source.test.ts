import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const windowSource = readFileSync(
  fileURLToPath(new URL("../../ui/cluster/ClusterWindow.tsx", import.meta.url)),
  "utf8",
)
const controller = readFileSync(
  fileURLToPath(new URL("../../ui/cluster/controller.ts", import.meta.url)),
  "utf8",
)

test("the cluster is an overlay, non-exclusive, keyless layer window", () => {
  assert.match(windowSource, /layer=\{Astal\.Layer\.OVERLAY\}/)
  assert.match(windowSource, /exclusivity=\{Astal\.Exclusivity\.IGNORE\}/)
  assert.match(windowSource, /keymode=\{Astal\.Keymode\.NONE\}/)
  assert.match(windowSource, /visible=\{false\}/)
  assert.match(windowSource, /name="capture-recording-cluster"/)
  assert.match(windowSource, /set_size_request\(width, height\)/)
})

test("hide destroys the window instead of leaving a transparent surface", () => {
  assert.match(controller, /app\.remove_window\(entry\.handle\.window\)/)
  assert.match(controller, /entry\.handle\.destroy\(\)/)
  assert.match(controller, /unsubscribeFeed = captureState\.subscribe/)
  assert.match(controller, /captureState\.control\(hud\.jobId, pauseAction\(hud\)\)/)
  assert.match(controller, /captureState\.control\(hud\.jobId, "stop"\)/)
  assert.doesNotMatch(controller, /window\.visible = false/)
})
