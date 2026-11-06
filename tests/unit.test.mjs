// ---------------------------------------------------------------------------
// Stock-runner unit tests for the capture tool's live palette refresh.
//
// These execute the app's real pure modules under plain Node:
//   - lib/appearance.ts        (ordering and the per-window registry)
//   - ui/appearance.ts         (the per-window fan-out)
//   - the platform's appearance-refresh handler (the same handler app.tsx
//     registers, including hash idempotence and retry semantics)
//
// No AGS/GTK import is reachable from any module loaded here.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { PALETTE_REFRESH_COMMAND, createPaletteRefreshHandler } from "ags-platform/ports/palette-refresh"
import { createAppearanceRefreshHandler } from "ags-platform/ports/appearance-refresh"
import {
  applyAppearance,
  createAppearanceRegistry,
} from "../lib/appearance.ts"
import { refreshSurfaces } from "../ui/appearance.ts"

const HASH = "appearance-2026-10-27"

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

/** The platform helper only needs `apply()` from an Appearance. */
function fakeAppearance() {
  const calls = { applies: 0 }
  return {
    calls,
    appearance: {
      apply() {
        calls.applies += 1
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

test("one failing window does not strand the other windows on the old palette", () => {
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

// ── The real handler ───────────────────────────────────────────────────────

test("palette-refresh applies the appearance, runs work and answers once", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(calls.applies, 1, "the platform helper applied the whole appearance")
  assert.equal(work, 1, "the app-owned fan-out ran")
  assert.equal(responses.length, 1, "exactly one response")
  assert.equal(typeof responses[0], "string", "AGS transport is a string")
  assert.equal(responses[0], JSON.stringify({ ok: true }))
})

test("palette-refresh re-applies the appearance but skips work for the same hash", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(calls.applies, 2, "the whole appearance is always re-applied")
  assert.equal(work, 1, "the same hash does not rebuild the app surface twice")
  assert.deepEqual(responses, [JSON.stringify({ ok: true }), JSON.stringify({ ok: true })])
})

test("palette-refresh reports a thrown work as retryable and does not record the hash", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
    if (work === 1) throw new Error("theme pointer missing")
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  assert.deepEqual(JSON.parse(responses[0]), {
    ok: false,
    error: "theme pointer missing",
    retryable: true,
  })

  const retry = []
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => retry.push(response))
  assert.equal(calls.applies, 2, "the appearance is re-applied on the retry")
  assert.equal(work, 2, "the failed hash was not recorded as applied")
  assert.deepEqual(JSON.parse(retry[0]), { ok: true })
})

test("a malformed palette-refresh request never runs the refresh", () => {
  const responses = []
  const { calls, appearance } = fakeAppearance()
  let work = 0
  const handler = createAppearanceRefreshHandler(appearance, () => {
    work += 1
  })

  handler([PALETTE_REFRESH_COMMAND], (response) => responses.push(response))
  assert.equal(calls.applies, 0)
  assert.equal(work, 0)
  assert.equal(responses.length, 1)
  assert.deepEqual(JSON.parse(responses[0]), {
    ok: false,
    error: "malformed palette-refresh request",
    retryable: false,
  })
})

test("an in-flight refresh answers the second request busy, never a queue", async () => {
  // The fake runtime overlap REQ-011 requires. The real capture refresh is
  // synchronous, so this exercises the platform helper's busy contract that
  // protects any future async surface without inventing a queue here.
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let applies = 0
  const handler = createPaletteRefreshHandler(async () => {
    applies += 1
    await gate
    return { status: "applied" }
  })

  const responses = []
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(applies, 1, "the second request must not start a second refresh")
  assert.deepEqual(JSON.parse(responses[0]), { ok: false, error: "busy", retryable: true })

  release()
  await gate
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(responses.length, 2, "the first request still answers exactly once")
  assert.deepEqual(JSON.parse(responses[1]), { ok: true })
})
