// ---------------------------------------------------------------------------
// Stock-runner unit tests for the capture tool's live palette refresh.
//
// These execute the app's real pure modules under plain Node:
//   - lib/appearance.ts        (ordering, registry, hash idempotence)
//   - lib/palette-refresh.ts   (the same handler app.tsx registers)
//   - ui/appearance.ts         (the per-window fan-out)
//
// No AGS/GTK import is reachable from any module loaded here.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { PALETTE_REFRESH_COMMAND, createPaletteRefreshHandler } from "ags-platform/ports/palette-refresh"
import {
  applyAppearance,
  createAppearanceRefresh,
  createAppearanceRegistry,
} from "../lib/appearance.ts"
import { createCapturePaletteRefresh } from "../lib/palette-refresh.ts"
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

test("appearance refresh is idempotent by appearance hash", () => {
  let applies = 0
  const refresh = createAppearanceRefresh(() => {
    applies += 1
  })

  assert.deepEqual(refresh(HASH), { status: "applied" })
  assert.equal(applies, 1)
  assert.deepEqual(refresh(HASH), { status: "applied" })
  assert.equal(applies, 1, "the same hash is a safe no-op")
  assert.deepEqual(refresh("appearance-next"), { status: "applied" })
  assert.equal(applies, 2, "a new hash applies again")
})

test("a failed appearance refresh is retried for the same hash", () => {
  let applies = 0
  const refresh = createAppearanceRefresh(() => {
    applies += 1
    if (applies === 1) throw new Error("palette not ready")
  })

  assert.throws(() => refresh(HASH), /palette not ready/)
  assert.deepEqual(refresh(HASH), { status: "applied" })
  assert.equal(applies, 2, "the failed hash was not recorded as applied")
})

// ── The real handler ───────────────────────────────────────────────────────

test("palette-refresh answers once with the protocol's JSON string", () => {
  const responses = []
  let applies = 0
  const handler = createCapturePaletteRefresh(() => {
    applies += 1
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(applies, 1, "the real refresh ran")
  assert.equal(responses.length, 1, "exactly one response")
  assert.equal(typeof responses[0], "string", "AGS transport is a string")
  assert.equal(responses[0], JSON.stringify({ ok: true }))
})

test("palette-refresh is a no-op for the same hash but still applied", () => {
  const responses = []
  let applies = 0
  const handler = createCapturePaletteRefresh(() => {
    applies += 1
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))

  assert.equal(applies, 1)
  assert.deepEqual(responses, [JSON.stringify({ ok: true }), JSON.stringify({ ok: true })])
})

test("palette-refresh reports a thrown refresh as retryable and does not record the hash", () => {
  const responses = []
  let applies = 0
  const handler = createCapturePaletteRefresh(() => {
    applies += 1
    throw new Error("theme pointer missing")
  })

  handler([PALETTE_REFRESH_COMMAND, HASH], (response) => responses.push(response))
  assert.deepEqual(JSON.parse(responses[0]), {
    ok: false,
    error: "theme pointer missing",
    retryable: true,
  })

  const next = []
  const retry = createCapturePaletteRefresh(() => {
    applies += 1
  })
  retry([PALETTE_REFRESH_COMMAND, HASH], (response) => next.push(response))
  assert.deepEqual(JSON.parse(next[0]), { ok: true })
})

test("a malformed palette-refresh request never runs the refresh", () => {
  const responses = []
  let applies = 0
  const handler = createCapturePaletteRefresh(() => {
    applies += 1
  })

  handler([PALETTE_REFRESH_COMMAND], (response) => responses.push(response))
  assert.equal(applies, 0)
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
