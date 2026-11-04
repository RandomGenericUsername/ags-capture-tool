import { test } from "node:test"
import assert from "node:assert/strict"
import type { ClusterAnchor } from "ags-platform/ports/capture-cluster"
import type { MonitorDescriptor } from "../../domain/monitor-registry"
import {
  clusterKeyForAnchor,
  clusterPlacement,
  popoverPlacement,
  resolveClusterMonitor,
  validClusterAnchor,
} from "../../domain/cluster-window.ts"

function monitor(
  connector: string | null,
  x: number,
  y: number,
  width = 1920,
  height = 1080,
): MonitorDescriptor {
  return {
    connector,
    model: connector ?? "unknown",
    manufacturer: "test",
    geometry: { x, y, width, height },
  }
}

function anchor(overrides: Partial<ClusterAnchor> = {}): ClusterAnchor {
  return {
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
    ...overrides,
  }
}

test("the connector wins over geometry", () => {
  const found = resolveClusterMonitor(
    [monitor("eDP-1", 0, 0), monitor("HDMI-A-1", -1920, 0)],
    anchor({ connector: "HDMI-A-1", monitorX: -1920, monitorWidth: 1920 }),
  )
  assert.equal(found?.connector, "HDMI-A-1")
})

test("an unknown connector falls back to exact global geometry", () => {
  const found = resolveClusterMonitor(
    [monitor("eDP-1", 0, 0), monitor("HDMI-A-1", -1920, 0)],
    anchor({
      connector: "DP-9",
      monitorX: -1920,
      monitorY: 0,
      monitorWidth: 1920,
      monitorHeight: 1080,
      x: 20,
    }),
  )
  assert.equal(found?.connector, "HDMI-A-1")
})

test("no connector and no geometry match is unknown, not a guess", () => {
  assert.equal(
    resolveClusterMonitor(
      [monitor("eDP-1", 0, 0)],
      anchor({ connector: null, monitorX: 1920, monitorY: 0 }),
    ),
    null,
  )
  assert.equal(
    clusterKeyForAnchor(
      [monitor("eDP-1", 0, 0)],
      anchor({ connector: "missing", monitorX: 1920 }),
    ),
    null,
  )
  // A stale connector may still be recovered by exact geometry.
  assert.equal(
    clusterKeyForAnchor(
      [monitor("eDP-1", 0, 0)],
      anchor({ connector: "missing" }),
    ),
    "connector:eDP-1",
  )
})

test("the cluster key follows the shared monitor identity", () => {
  assert.equal(
    clusterKeyForAnchor([monitor("eDP-1", 0, 0)], anchor()),
    "connector:eDP-1",
  )
  assert.equal(
    clusterKeyForAnchor(
      [{ ...monitor(null, 0, 0), model: "", manufacturer: "" }],
      anchor({ connector: null }),
    ),
    "geometry:0,0,1920,1080",
  )
})

test("placement is the slot in monitor-local logical pixels", () => {
  assert.deepEqual(clusterPlacement(anchor({ x: 100.4, y: 9.6, width: 76.5, height: 38.4 })), {
    marginTop: 10,
    marginLeft: 100,
    width: 77,
    height: 38,
  })
})

test("a negative-origin monitor does not shift its slot", () => {
  const placement = clusterPlacement(
    anchor({ monitorX: -1920, x: 12, y: 8, width: 76, height: 38 }),
  )
  assert.equal(placement.marginLeft, 12)
  assert.equal(placement.marginTop, 8)
})

test("top bars open below the slot; bottom bars open above it", () => {
  const below = popoverPlacement(anchor(), { width: 216, height: 100 })
  assert.equal(below.x, 1476)
  assert.equal(below.y, 54)

  const above = popoverPlacement(anchor({ y: 1000, edge: "bottom" }), {
    width: 216,
    height: 100,
  })
  assert.equal(above.y, 894)
})

test("popover placement clamps into the monitor", () => {
  const left = popoverPlacement(anchor({ x: 0, width: 76 }), {
    width: 216,
    height: 100,
  })
  assert.equal(left.x, 8)

  const right = popoverPlacement(anchor({ x: 1900, width: 20 }), {
    width: 216,
    height: 100,
  })
  assert.equal(right.x, 1920 - 216 - 8)

  const high = popoverPlacement(anchor({ y: 2, edge: "bottom" }), {
    width: 216,
    height: 100,
  })
  assert.equal(high.y, 8)
})

test("a zero-size or off-monitor slot is rejected", () => {
  assert.equal(validClusterAnchor(anchor()), true)
  assert.equal(validClusterAnchor(anchor({ width: 0 })), false)
  assert.equal(validClusterAnchor(anchor({ x: -1 })), false)
  assert.equal(validClusterAnchor(anchor({ x: 1920 })), false)
  assert.equal(validClusterAnchor(anchor({ y: 1080 })), false)
})
