import { test } from "node:test"
import assert from "node:assert/strict"
import type { PaletteRefreshRequestHandler } from "ags-platform/ports/palette-refresh"
import {
  createCaptureRequestHandler,
} from "../../lib/request-dispatch.ts"
import type { ClusterHandler } from "../../lib/cluster-request.ts"

function recorder() {
  const responses: string[] = []
  return {
    responses,
    respond: (response: string) => responses.push(response),
  }
}

test("palette-refresh routes to the existing helper unchanged", () => {
  const seen: unknown[] = []
  const palette: PaletteRefreshRequestHandler = (argv, respond) => {
    seen.push([...argv])
    respond('{"ok":true,"status":"applied"}')
  }
  const cluster: ClusterHandler = () => {
    throw new Error("must not run")
  }
  const output = recorder()

  createCaptureRequestHandler(palette, cluster)(
    ["palette-refresh", "hash-1"],
    output.respond,
  )

  assert.deepEqual(seen, [["palette-refresh", "hash-1"]])
  assert.deepEqual(output.responses, ['{"ok":true,"status":"applied"}'])
})

test("capture-cluster encodes the handler's response", () => {
  const palette: PaletteRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = (text) => {
    assert.equal(text, '{"v":1}')
    return { ok: true }
  }
  const output = recorder()

  createCaptureRequestHandler(palette, cluster)(
    ["capture-cluster", '{"v":1}'],
    output.respond,
  )

  assert.deepEqual(output.responses, ['{"ok":true}'])
})

test("an unknown command is one JSON error, not a text ack", () => {
  const palette: PaletteRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = () => {
    throw new Error("must not run")
  }
  const output = recorder()

  createCaptureRequestHandler(palette, cluster)(["nope"], output.respond)

  assert.deepEqual(output.responses, [
    '{"ok":false,"error":"unknown-command","retryable":false}',
  ])
})

test("a throwing cluster handler still gets exactly one response", () => {
  const palette: PaletteRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = () => {
    throw new Error("boom")
  }
  const output = recorder()

  createCaptureRequestHandler(palette, cluster)(
    ["capture-cluster", "{}"],
    output.respond,
  )

  assert.deepEqual(output.responses, [
    '{"ok":false,"error":"internal","retryable":true}',
  ])
})
