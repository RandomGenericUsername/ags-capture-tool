import { test } from "node:test"
import assert from "node:assert/strict"
import {
  APPEARANCE_REFRESH_COMMAND,
  type AppearanceRefreshRequestHandler,
} from "ags-platform/ports/appearance-refresh"
import {
  createCaptureRequestHandler,
} from "../../lib/request-dispatch.ts"
import type { ClusterHandler } from "../../lib/cluster-request.ts"

const GEN_HASH = "a".repeat(64)

function recorder() {
  const responses: string[] = []
  return {
    responses,
    respond: (response: string) => responses.push(response),
  }
}

test("appearance-refresh routes to the platform handler unchanged", () => {
  const seen: unknown[] = []
  const appearance: AppearanceRefreshRequestHandler = (argv, respond) => {
    seen.push([...argv])
    respond(JSON.stringify({ applied: GEN_HASH }))
  }
  const cluster: ClusterHandler = () => {
    throw new Error("must not run")
  }
  const output = recorder()

  createCaptureRequestHandler(appearance, cluster)(
    [APPEARANCE_REFRESH_COMMAND, GEN_HASH],
    output.respond,
  )

  assert.deepEqual(seen, [[APPEARANCE_REFRESH_COMMAND, GEN_HASH]])
  assert.deepEqual(output.responses, [JSON.stringify({ applied: GEN_HASH })])
})

test("the retired palette-refresh command is not a capture command", () => {
  const appearance: AppearanceRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = () => {
    throw new Error("must not run")
  }
  const output = recorder()

  createCaptureRequestHandler(appearance, cluster)(
    ["palette-refresh", GEN_HASH],
    output.respond,
  )

  assert.deepEqual(output.responses, [
    '{"ok":false,"error":"unknown-command","retryable":false}',
  ])
})

test("capture-cluster encodes the handler's response", () => {
  const appearance: AppearanceRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = (text) => {
    assert.equal(text, '{"v":1}')
    return { ok: true }
  }
  const output = recorder()

  createCaptureRequestHandler(appearance, cluster)(
    ["capture-cluster", '{"v":1}'],
    output.respond,
  )

  assert.deepEqual(output.responses, ['{"ok":true}'])
})

test("an unknown command is one JSON error, not a text ack", () => {
  const appearance: AppearanceRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = () => {
    throw new Error("must not run")
  }
  const output = recorder()

  createCaptureRequestHandler(appearance, cluster)(["nope"], output.respond)

  assert.deepEqual(output.responses, [
    '{"ok":false,"error":"unknown-command","retryable":false}',
  ])
})

test("a throwing cluster handler still gets exactly one response", () => {
  const appearance: AppearanceRefreshRequestHandler = () => {
    throw new Error("must not run")
  }
  const cluster: ClusterHandler = () => {
    throw new Error("boom")
  }
  const output = recorder()

  createCaptureRequestHandler(appearance, cluster)(
    ["capture-cluster", "{}"],
    output.respond,
  )

  assert.deepEqual(output.responses, [
    '{"ok":false,"error":"internal","retryable":true}',
  ])
})
