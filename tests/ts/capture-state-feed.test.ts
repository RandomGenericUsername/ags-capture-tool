// ---------------------------------------------------------------------------
// The platform-event-bus binding, against a mocked hub (REQ-004).
//
// `lib/capture-state-feed.ts` is desktop-free exactly so this suite can execute
// the subscribe/restart/control wiring under Node. The Gio adapter is checked
// by source assertion: it must be the platform's shared client (AD-5), not an
// app-local event reader.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  CAPTURE_STATE_TOPIC,
  createCaptureStateFeed,
} from "../../lib/capture-state-feed.ts"
import type { CaptureStateSource } from "../../ports/capture-state-feed.ts"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

function sourceText(...parts: string[]): string {
  return readFileSync(fileURLToPath(new URL(parts.join("/"), `file://${ROOT}/`)), "utf8")
}

/** A scripted hub: records every call and can push a payload back. */
function mockHub() {
  const subscribes: Array<{ topic: string; handler: (topic: string, payload: Record<string, unknown>) => void }> = []
  const restarts: Array<() => void> = []
  const controls: Array<[string, string]> = []
  const unsubscribed: string[] = []

  const source: CaptureStateSource = {
    subscribe(topic, handler) {
      subscribes.push({ topic, handler })
      return () => unsubscribed.push(topic)
    },
    onRestart(handler) {
      restarts.push(handler)
      return () => {
        const at = restarts.indexOf(handler)
        if (at > -1) restarts.splice(at, 1)
      }
    },
    control(jobId, action) {
      controls.push([jobId, action])
    },
  }
  return { source, subscribes, restarts, controls, unsubscribed }
}

test("subscribe uses the one capture.state topic and forwards the payload", () => {
  const hub = mockHub()
  const feed = createCaptureStateFeed(hub.source)
  const received: Array<Record<string, unknown>> = []

  feed.subscribe((payload) => received.push(payload as Record<string, unknown>))

  assert.equal(hub.subscribes.length, 1)
  assert.equal(hub.subscribes[0].topic, CAPTURE_STATE_TOPIC)
  assert.equal(CAPTURE_STATE_TOPIC, "capture.state")

  hub.subscribes[0].handler("capture.state", {
    state: "recording",
    elapsed_seconds: 4,
    job_id: "job-9",
  })
  assert.deepEqual(received, [{ state: "recording", elapsed_seconds: 4, job_id: "job-9" }])
})

test("unsubscribe forwards to the platform client", () => {
  const hub = mockHub()
  const feed = createCaptureStateFeed(hub.source)
  const off = feed.subscribe(() => {})
  off()
  assert.deepEqual(hub.unsubscribed, [CAPTURE_STATE_TOPIC])
})

test("control routes the job id and action through hub.control", () => {
  const hub = mockHub()
  const feed = createCaptureStateFeed(hub.source)
  feed.control("job-9", "pause")
  feed.control("job-9", "resume")
  feed.control("job-9", "stop")
  assert.deepEqual(hub.controls, [
    ["job-9", "pause"],
    ["job-9", "resume"],
    ["job-9", "stop"],
  ])
})

test("an empty job id never reaches the hub", () => {
  const hub = mockHub()
  const feed = createCaptureStateFeed(hub.source)
  feed.control("", "stop")
  assert.deepEqual(hub.controls, [])
})

test("a hub restart handler is forwarded and can be removed", () => {
  const hub = mockHub()
  const feed = createCaptureStateFeed(hub.source)
  let restarts = 0
  const off = feed.onRestart(() => {
    restarts += 1
  })
  assert.equal(hub.restarts.length, 1)
  hub.restarts[0]()
  assert.equal(restarts, 1)
  off()
  assert.equal(hub.restarts.length, 0)
})

test("a reduced source without onRestart/control degrades quietly", () => {
  const feed = createCaptureStateFeed({
    subscribe: () => () => {},
  })
  assert.doesNotThrow(() => feed.control("job-9", "stop"))
  assert.doesNotThrow(() => feed.onRestart(() => {})())
})

test("the Gio adapter is the platform's shared client, not a second reader", () => {
  const adapter = sourceText("adapters", "platform-capture-state-feed.ts")
  assert.match(adapter, /from "ags-platform\/adapters\/event-bus"/)
  assert.match(adapter, /domainEvents/)
  assert.match(adapter, /createCaptureStateFeed\(domainEvents\)/)
})
