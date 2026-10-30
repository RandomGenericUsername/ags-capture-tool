// ---------------------------------------------------------------------------
// DOMAIN: capture-bar placement arithmetic (design.md D3/§11.4, REQ-002).
//
// Top placement sits below every EXCLUSIVE top surface the compositor reports,
// then adds the manual `bar.offsetPx` escape hatch. Bottom placement keeps the
// bar at the bottom edge with no reserved-zone offset.
//
// PURE: the compositor read and the GTK margin write live in the adapter and
// the window respectively; this module only owns the number.
// ---------------------------------------------------------------------------

import type { ConfigBarPosition } from "./settings"

/**
 * The top margin for a bar at `position`.
 *
 * `reservedTop` is the compositor's measured exclusive zone at the top of this
 * monitor (48px on the reference host, where ags-bar owns it). At offset 0 the
 * bar therefore starts exactly below that zone and cannot overlap ags-bar.
 * The same rule applies to non-exclusive overlays only through `offsetPx`,
 * because `reserved_*` cannot see them.
 */
export function barMarginTop(
  position: ConfigBarPosition,
  reservedTop: number,
  offsetPx: number,
): number {
  if (position !== "top") return 0
  const reserved = Number.isFinite(reservedTop) ? Math.max(0, Math.trunc(reservedTop)) : 0
  const offset = Number.isFinite(offsetPx) ? Math.max(0, Math.trunc(offsetPx)) : 0
  return reserved + offset
}
