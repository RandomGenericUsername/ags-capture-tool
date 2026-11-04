// ---------------------------------------------------------------------------
// DOMAIN: where a bar-reported recording slot belongs and how a capture-owned
// cluster is placed on it (SPIKE-003 option B).
//
// The bar measures its own slot and sends MONITOR-LOCAL LOGICAL pixels. This
// module does not scale them: GDK, layer-shell margins and the payload all use
// the same logical space. The monitor geometry in the anchor is a fallback
// identity for a connector that is missing or stale, not a coordinate origin.
//
// PURE: no `ags/*`, no `gi://*`, no I/O.
// ---------------------------------------------------------------------------

import type { ClusterAnchor } from "ags-platform/ports/capture-cluster"
import { monitorKey, type MonitorDescriptor } from "./monitor-registry"

export interface ClusterPlacement {
  /** Layer-shell margin from the monitor's top edge. */
  marginTop: number
  /** Layer-shell margin from the monitor's left edge. */
  marginLeft: number
  width: number
  height: number
}

export interface PopoverSize {
  width: number
  height: number
}

export interface PopoverPlacement {
  x: number
  y: number
  width: number
  height: number
}

const POPOVER_GAP = 6
const POPOVER_INSET = 8

/** Resolve the monitor that owns an anchor. Connector wins, geometry falls back. */
export function resolveClusterMonitor(
  monitors: readonly MonitorDescriptor[],
  anchor: ClusterAnchor,
): MonitorDescriptor | null {
  if (anchor.connector !== null) {
    const byConnector = monitors.find(
      (monitor) => monitor.connector === anchor.connector,
    )
    if (byConnector) return byConnector
  }
  return (
    monitors.find(
      (monitor) =>
        monitor.geometry.x === anchor.monitorX &&
        monitor.geometry.y === anchor.monitorY &&
        monitor.geometry.width === anchor.monitorWidth &&
        monitor.geometry.height === anchor.monitorHeight,
    ) ?? null
  )
}

/** The stable cluster key for an anchor, or null when no monitor owns it. */
export function clusterKeyForAnchor(
  monitors: readonly MonitorDescriptor[],
  anchor: ClusterAnchor,
): string | null {
  const monitor = resolveClusterMonitor(monitors, anchor)
  return monitor === null ? null : monitorKey(monitor)
}

/** Layer-shell placement for the exact slot the bar measured. */
export function clusterPlacement(anchor: ClusterAnchor): ClusterPlacement {
  return {
    marginTop: Math.round(anchor.y),
    marginLeft: Math.round(anchor.x),
    width: Math.max(1, Math.round(anchor.width)),
    height: Math.max(1, Math.round(anchor.height)),
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

/**
 * Placement for the separate-popover fallback window.
 *
 * `edge` is the bar's edge, not the popover's: a top bar opens below the slot,
 * a bottom bar opens above it. Both axes are clamped into the monitor so a
 * slot near a corner cannot push the popover off-screen.
 */
export function popoverPlacement(
  anchor: ClusterAnchor,
  size: PopoverSize,
): PopoverPlacement {
  const width = Math.max(1, Math.round(size.width))
  const height = Math.max(1, Math.round(size.height))
  const monitorWidth = Math.max(1, Math.round(anchor.monitorWidth))
  const monitorHeight = Math.max(1, Math.round(anchor.monitorHeight))

  const desiredX = Math.round(anchor.x + (anchor.width - width) / 2)
  const desiredY =
    anchor.edge === "top"
      ? Math.round(anchor.y + anchor.height + POPOVER_GAP)
      : Math.round(anchor.y - height - POPOVER_GAP)

  return {
    x: clamp(
      desiredX,
      POPOVER_INSET,
      monitorWidth - width - POPOVER_INSET,
    ),
    y: clamp(
      desiredY,
      POPOVER_INSET,
      monitorHeight - height - POPOVER_INSET,
    ),
    width,
    height,
  }
}

/** A bar slot is usable only when it has a positive on-monitor rectangle. */
export function validClusterAnchor(anchor: ClusterAnchor): boolean {
  return (
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y) &&
    anchor.width > 0 &&
    anchor.height > 0 &&
    anchor.x >= 0 &&
    anchor.y >= 0 &&
    anchor.x < anchor.monitorWidth &&
    anchor.y < anchor.monitorHeight
  )
}

/**
 * Decide whether a request is stale relative to the last accepted sequence.
 *
 * The payload has no bar-instance id. A bar restart resets its local sequence
 * to 1, so `seq === 1` is treated as a new generation and the tombstone is
 * discarded. A later stale request from the old instance would have to also
 * carry seq 1, which only happens at its own start.
 */
export interface SequenceDecision {
  stale: boolean
  generationReset: boolean
}

export function sequenceDecision(
  last: number | undefined,
  seq: number,
): SequenceDecision {
  if (last === undefined) return { stale: false, generationReset: false }
  if (seq === 1) return { stale: false, generationReset: true }
  return { stale: seq < last, generationReset: false }
}
