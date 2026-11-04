import { test } from "node:test"
import assert from "node:assert/strict"
import type { ClusterAnchor, ClusterRequest } from "ags-platform/ports/capture-cluster"
import {
  ClusterHostError,
  createClusterRequestHandler,
  type ClusterHost,
} from "../../lib/cluster-request.ts"

const anchor: ClusterAnchor = {
  connector: "eDP-1",
  monitorX: 0,
  monitorY: 0,
  monitorWidth: 1920,
  monitorHeight: 1080,
  scale: 1,
  x: 1546,
  y: 10,
  width: 76,
  height: 38,
  edge: "top",
}

function request(overrides: Partial<ClusterRequest> = {}): ClusterRequest {
  return {
    v: 1,
    command: "show",
    seq: 4,
    compact: true,
    anchor,
    ...overrides,
  }
}

function host(overrides: Partial<ClusterHost> = {}): ClusterHost & {
  calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    show: (value) => calls.push(`show:${value.seq}`),
    update: (value) => calls.push(`update:${value.seq}`),
    hide: (value) => calls.push(`hide:${value.seq}`),
    popoverClose: () => calls.push("popover-close"),
    ...overrides,
  }
}

test("each command reaches its host method exactly once", () => {
  const target = host()
  const handle = createClusterRequestHandler(target)

  assert.deepEqual(handle(JSON.stringify(request())), { ok: true })
  assert.deepEqual(handle(JSON.stringify(request({ command: "update", seq: 5 }))), {
    ok: true,
  })
  assert.deepEqual(handle(JSON.stringify(request({ command: "hide", seq: 6 }))), {
    ok: true,
  })
  assert.deepEqual(
    handle(JSON.stringify({ v: 1, command: "popover-close", seq: 7, compact: true })),
    { ok: true },
  )

  assert.deepEqual(target.calls, [
    "show:4",
    "update:5",
    "hide:6",
    "popover-close",
  ])
})

test("malformed and unsupported requests never reach the host", () => {
  const target = host()
  const handle = createClusterRequestHandler(target)

  assert.deepEqual(handle("{"), {
    ok: false,
    error: "bad-request",
    retryable: false,
  })
  assert.deepEqual(
    handle(JSON.stringify({ ...request(), v: 2 })),
    { ok: false, error: "unsupported-version", retryable: false },
  )
  assert.deepEqual(target.calls, [])
})

test("an unknown monitor is retryable and keeps its protocol code", () => {
  const target = host({
    show: () => {
      throw new ClusterHostError("unknown-monitor", "no monitor", true)
    },
  })
  const handle = createClusterRequestHandler(target)
  assert.deepEqual(handle(JSON.stringify(request())), {
    ok: false,
    error: "unknown-monitor",
    retryable: true,
  })
})

test("an unexpected host exception is retryable internal", () => {
  const target = host({
    hide: () => {
      throw new Error("boom")
    },
  })
  const handle = createClusterRequestHandler(target)
  assert.deepEqual(
    handle(JSON.stringify(request({ command: "hide" }))),
    { ok: false, error: "internal", retryable: true },
  )
})
