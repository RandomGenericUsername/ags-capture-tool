// ---------------------------------------------------------------------------
// Stock-runner unit tests for the capture tool's live appearance refresh.
//
// These execute the app's real pure modules under plain Node:
//   - lib/appearance.ts        (ordering and the per-window registry)
//   - ui/appearance.ts         (the per-window fan-out)
//   - the platform's appearance-refresh handler (the same handler app.tsx
//     registers, including generation idempotence and retry semantics)
//
// No AGS/GTK import is reachable from any module loaded here.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  APPEARANCE_REFRESH_COMMAND,
  createAppearanceRefreshHandler,
} from "ags-platform/ports/appearance-refresh"
import {
  applyAppearance,
  createAppearanceRegistry,
} from "../lib/appearance.ts"
import { refreshSurfaces } from "../ui/appearance.ts"

const HASH = "a".repeat(64)
const HASH_B = "b".repeat(64)

function recorder() {
  const calls = []
  return {
    calls,
    surface: {
      clearCaches: () => calls.push("clear"),
      rebuildIcons: () => calls.push("icons"),
      refreshWindow: () => calls.push("window"),
    },
  }
}

/** The platform helper only needs `applyGeneration()` from an Appearance. */
function fakeAppearance(outcome) {
  const calls = { applies: 0, applied: [] }
  return {
    calls,
    appearance: {
      applyGeneration(genHash) {
        calls.applies += 1
        calls.applied.push(genHash)
        return outcome ?? { status: "applied", genHash }
      },
    },
  }
}

// ── Appearance core ────────────────────────────────────────────────────────

test("applyAppearance clears icon caches before rebuilding icons and the window", () => {
  const { calls, surface } = recorder()
  applyAppearance(surface)
  assert.deepEqual(calls, ["clear", "icons", "window"])
})

test("the registry fans out in registration order and unregisters a destroyed window", () => {
  const registry = createAppearanceRegistry()
  const first = recorder()
  const second = recorder()
  const off = registry.register(first.surface)
  registry.register(second.surface)

  assert.equal(registry.surfaces().length, 2)
  refreshSurfaces(registry.surfaces())
  assert.deepEqual(first.calls, ["clear", "icons", "window"])
  assert.deepEqual(second.calls, ["clear", "icons", "window"])

  off()
  off() // idempotent: a second destroy must not remove another surface
  assert.equal(registry.surfaces().length, 1)
  refreshSurfaces(registry.surfaces())
  assert.deepEqual(first.calls, ["clear", "icons", "window"], "unregistered window was not refreshed")
})

test("one failing window does not strand the other windows on the old generation", () => {
  const good = recorder()
  const calls = []
  const bad = {
    clearCaches: () => calls.push("bad-clear"),
    rebuildIcons: () => {
      throw new Error("bad icon")
    },
    refreshWindow: () => calls.push("bad-window"),
  }

  assert.throws(() => refreshSurfaces([bad, good.surface]), /bad icon/)
  assert.deepEqual(calls, ["bad-clear"])
  assert.deepEqual(good.calls, ["clear", "icons", "window"], "the good window was still refreshed")
})

// ── The real v3 handler ────────────────────────────────────────────────────

test("appearance-refresh applies the requested generation, runs work and answers once", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, (genHash) => {
    assert.equal(genHash, HASH)
    work += 1
    return { status: "applied" }
  })

  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(calls.applies, 1, "the platform helper applied the requested generation")
  assert.deepEqual(calls.applied, [HASH])
  assert.equal(work, 1, "the app-owned fan-out ran")
  assert.equal(responses.length, 1, "exactly one response")
  assert.equal(typeof responses[0], "string", "AGS transport is a string")
  assert.deepEqual(JSON.parse(responses[0]), { applied: HASH })
})

test("appearance-refresh re-applies the generation but skips work for the same hash", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
    return { status: "applied" }
  })

  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(calls.applies, 2, "the requested generation is always re-verified")
  assert.equal(work, 1, "the same hash does not rebuild the app surface twice")
  assert.deepEqual(responses.map(JSON.parse), [
    { applied: HASH },
    { applied: HASH },
  ])
})

test("appearance-refresh reports a thrown work as retryable and does not record the hash", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
    if (work === 1) throw new Error("icon generation missing")
    return { status: "applied" }
  })

  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "icon generation missing",
    retryable: true,
    genHash: HASH,
  })

  const retry = []
  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => retry.push(response))
  assert.equal(calls.applies, 2, "the generation is re-verified on the retry")
  assert.equal(work, 2, "the failed hash was not recorded as applied")
  assert.deepEqual(JSON.parse(retry[0]), { applied: HASH })
})

test("a stale generation is deferred with the requested hash", () => {
  const responses = []
  const { appearance } = fakeAppearance({
    status: "deferred",
    reason: `current generation moved to ${HASH_B}`,
    genHash: HASH,
  })
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
    return { status: "applied" }
  })

  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(work, 0, "a deferred generation runs no app work")
  assert.deepEqual(JSON.parse(responses[0]), {
    deferred: `current generation moved to ${HASH_B}`,
    genHash: HASH,
  })
})

test("a malformed appearance-refresh request never runs the refresh", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
    return { status: "applied" }
  })

  handler([APPEARANCE_REFRESH_COMMAND], (response) => responses.push(response))
  assert.equal(calls.applies, 0)
  assert.equal(work, 0)
  assert.equal(responses.length, 1)
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "malformed appearance-refresh request",
    retryable: false,
    genHash: "0".repeat(64),
  })
})

test("the retired palette-refresh command is a malformed v3 request", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  const handler = createAppearanceRefreshHandler(appearance, () => ({
    status: "applied",
  }))

  handler(["palette-refresh", HASH], (response) => responses.push(response))

  assert.equal(calls.applies, 0)
  assert.deepEqual(JSON.parse(responses[0]), {
    failed: "malformed appearance-refresh request",
    retryable: false,
    genHash: HASH,
  })
})

test("an in-flight refresh answers the second request deferred:busy, never a queue", async () => {
  // The fake runtime overlap REQ-011 requires. The real capture refresh is
  // synchronous, so this exercises the platform helper's in-flight contract
  // that protects any future async surface without inventing a queue here.
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const { appearance } = fakeAppearance()
  let applies = 0
  const handler = createAppearanceRefreshHandler(appearance, async () => {
    applies += 1
    await gate
    return { status: "applied" }
  })

  const responses = []
  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  handler([APPEARANCE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(applies, 1, "the second request must not start a second refresh")
  assert.deepEqual(JSON.parse(responses[0]), { deferred: "busy", genHash: HASH })

  release()
  await gate
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(responses.length, 2, "the first request still answers exactly once")
  assert.deepEqual(JSON.parse(responses[1]), { applied: HASH })
})
