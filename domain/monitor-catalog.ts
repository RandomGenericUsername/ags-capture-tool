// ---------------------------------------------------------------------------
// DOMAIN: merge the GDK targetable set with the runtime monitor catalog
// (EPIC-002 §2.4, REQ-011).
//
// The rule is deliberately one-directional:
//   * GDK is authoritative. A catalog entry with no GDK match is IGNORED; the
//     user cannot target an output this app has no overlay/window for.
//   * A GDK monitor with no catalog entry still appears. This is the fallback
//     when `dotfiles-runtime` is missing, slow or returns `unavailable`.
//   * Join by connector. Focus comes from the existing focus port; the
//     catalog's `focused` is only a fallback when that port has no answer.
//   * Canonical order is x, y, connector. `compareMonitors()` is shared with
//     the selection controller so the badge/outline, dropdown and pending pick
//     all agree.
//
// PURE: no `ags/*`, no `gi://*`, no I/O.
// ---------------------------------------------------------------------------

import type { CatalogMonitor } from "../ports/monitor-catalog"
import type { MonitorDescriptor, MonitorGeometry } from "./monitor-registry"

/** One row the Monitor dropdown can render. */
export interface MonitorView {
  /** Stable value: the connector (also the backend's `--monitor`). */
  connector: string
  /** Primary row text; the connector, per the REQ-011 row contract. */
  label: string
  /** Secondary text: geometry, human label when it adds information, focus. */
  detail: string
  /** GDK geometry: the targetable set's rectangle. */
  geometry: MonitorGeometry
  focused: boolean
}

/** Anything with a connector and geometry can be ordered canonically. */
interface SortableMonitor {
  connector: string | null
  geometry: MonitorGeometry
}

function compareText(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Canonical monitor order: `geometry.x`, then `geometry.y`, then `connector`.
 *
 * Shared by `mergeMonitors()` and `SelectionController.monitors()` so the
 * `Monitor n` badge, the dropdown rows and the pending screen pick never
 * disagree about what "monitor 1" means.
 */
export function compareMonitors(a: SortableMonitor, b: SortableMonitor): number {
  if (a.geometry.x !== b.geometry.x) return a.geometry.x - b.geometry.x
  if (a.geometry.y !== b.geometry.y) return a.geometry.y - b.geometry.y
  return compareText(a.connector ?? "", b.connector ?? "")
}

function humanLabel(monitor: CatalogMonitor): string {
  const description = monitor.description.trim()
  if (description !== "") return description
  return monitor.label.trim()
}

function detailFor(
  connector: string,
  geometry: MonitorGeometry,
  label: string,
  focused: boolean,
): string {
  const parts = [`${geometry.width}×${geometry.height}`]
  if (label !== "" && label !== connector) parts.push(label)
  if (focused) parts.push("focused")
  return parts.join(" · ")
}

/**
 * Merge the GDK targetable set with catalog enrichment, in canonical order.
 *
 * Catalog-only connectors are dropped. A GDK-only monitor keeps its connector
 * as the row label and its GDK geometry as the detail. The returned array is a
 * new array; inputs are never mutated.
 */
export function mergeMonitors(
  targetable: readonly MonitorDescriptor[],
  catalog: readonly CatalogMonitor[],
  focusedConnector: string | null,
): MonitorView[] {
  const byConnector = new Map<string, CatalogMonitor>()
  for (const monitor of catalog) {
    if (monitor.connector !== "") byConnector.set(monitor.connector, monitor)
  }

  const views: MonitorView[] = []
  for (const monitor of targetable) {
    const connector = monitor.connector
    // A monitor with no connector cannot be passed to `--monitor`; it is not
    // targetable yet (the same rule the old dropdown applied).
    if (connector === null || connector === "") continue
    const entry = byConnector.get(connector)
    const focused =
      focusedConnector === null
        ? entry?.focused === true
        : connector === focusedConnector
    views.push({
      connector,
      label: connector,
      detail: detailFor(
        connector,
        monitor.geometry,
        entry === undefined ? "" : humanLabel(entry),
        focused,
      ),
      geometry: monitor.geometry,
      focused,
    })
  }
  return views.sort(compareMonitors)
}

// ---------------------------------------------------------------------------
// Runtime payload parsing (`schema_version: 1`).
//
// Kept here, pure and testable, so the adapter stays a thin exec/cache shell.
// The runtime schema is the contract; malformed payloads degrade to "no
// enrichment" rather than reaching the UI.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function catalogMonitor(value: unknown): CatalogMonitor | null {
  if (!isRecord(value)) return null
  const connector = stringField(value.connector)
  if (connector === "") return null
  const geometry = isRecord(value.geometry) ? value.geometry : {}
  return {
    connector,
    label: stringField(value.label) || connector,
    description: stringField(value.description),
    make: stringField(value.make),
    model: stringField(value.model),
    serial: stringField(value.serial),
    geometry: {
      x: numberField(geometry.x, 0),
      y: numberField(geometry.y, 0),
      width: numberField(geometry.width, 0),
      height: numberField(geometry.height, 0),
    },
    scale: numberField(value.scale, 1),
    transform: numberField(value.transform, 0),
    focused: value.focused === true,
    mirror_of: typeof value.mirror_of === "string" ? value.mirror_of : null,
  }
}

/** Map a parsed `monitors list` payload; `[]` for any contract mismatch. */
export function catalogFromPayload(payload: unknown): CatalogMonitor[] {
  if (!isRecord(payload) || payload.schema_version !== 1) return []
  const monitors = payload.monitors
  if (!Array.isArray(monitors)) return []
  const result: CatalogMonitor[] = []
  for (const entry of monitors) {
    const monitor = catalogMonitor(entry)
    if (monitor !== null) result.push(monitor)
  }
  return result
}

/** Parse raw CLI stdout; invalid JSON or `schema_version != 1` yields `[]`. */
export function parseCatalogPayload(raw: string): CatalogMonitor[] {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return []
  }
  return catalogFromPayload(payload)
}
