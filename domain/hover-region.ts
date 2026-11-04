// ---------------------------------------------------------------------------
// DOMAIN: the S4 pointer-reveal region during recording (REQ-006, SPIKE-001 C).
//
// The `hover` HUD must appear when the pointer is anywhere over the normal S1
// bar footprint, while the hidden S4 window stays UNMAPPED so clicks pass
// through. On Wayland a hoverable pixel is an input pixel, so the trigger is a
// compositor pointer poll, not a mapped hit area.
//
// Two pieces live here, both pure:
//
//   barFootprint      the bar rectangle in compositor coordinates, derived
//                     from the monitor geometry + the configured resting bar
//                     allocation (REQ-007), not the S1 option-lane window. It
//                     is NOT a hardcoded 1546x54: the rail follows its content,
//                     and top/bottom placement changes y.
//
//   updateHoverReveal the arm-after-leave state machine. If the pointer is on
//                     the Record CTA at commit it is already inside the
//                     footprint; revealing immediately would put the HUD in
//                     the first recorded frame. It must leave once before any
//                     enter can reveal.
//
// PURE: no GTK, no GLib, no timers, no I/O.
// ---------------------------------------------------------------------------

import type { PointerPoint } from "./pointer-position"
import type { ConfigBarPosition } from "./settings"

export interface HoverRect {
  x: number
  y: number
  width: number
  height: number
}

export interface HoverSize {
  width: number
  height: number
}

export interface HoverPlacement {
  position: ConfigBarPosition
  /** GTK's actual top margin (reserved_top + offsetPx for top placement). */
  marginTop: number
  /** GTK's actual bottom margin (the bar sets 0). */
  marginBottom: number
}

/**
 * The last allocation measured on the RESTING bar (S0 `.capture-bar.rail`),
 * including the connector of the monitor that owned it.
 *
 * REQ-007: the S1 lane is often much wider than the bar itself (1506 px vs
 * 142 px on the reference host), so the reveal must not inherit the S1 window
 * bounds. This is the real bar size, not the window size.
 */
export interface HoverBarMeasurement extends HoverSize {
  connector: string | null
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

/**
 * The bar footprint in compositor logical coordinates.
 *
 * `monitor` and the returned rect use the same coordinate space as
 * `Gdk.Monitor.get_geometry()` + Hyprland `cursorpos` (both logical layout
 * pixels). The bar is centred horizontally and anchored to one edge; the
 * surface allocation supplies both dimensions. REQ-007 passes the resting S0
 * bar (142×54 on the reference host), never the wider S1 option lane. Invalid
 * or zero geometry returns null (no region, no reveal) rather than a rect at
 * the origin.
 */
export function barFootprint(
  monitor: HoverRect,
  surface: HoverSize,
  placement: HoverPlacement,
): HoverRect | null {
  if (
    !finite(monitor.x) ||
    !finite(monitor.y) ||
    !finite(monitor.width) ||
    !finite(monitor.height) ||
    !finite(surface.width) ||
    !finite(surface.height)
  ) {
    return null
  }
  const width = Math.trunc(surface.width)
  const height = Math.trunc(surface.height)
  const monitorWidth = Math.trunc(monitor.width)
  const monitorHeight = Math.trunc(monitor.height)
  if (width <= 0 || height <= 0 || monitorWidth <= 0 || monitorHeight <= 0) {
    return null
  }
  const top = placement.position === "top"
  const marginTop = finite(placement.marginTop)
    ? Math.max(0, Math.trunc(placement.marginTop))
    : 0
  const marginBottom = finite(placement.marginBottom)
    ? Math.max(0, Math.trunc(placement.marginBottom))
    : 0
  // halign CENTER: the window is centred on the monitor.
  const x = Math.trunc(monitor.x) + Math.floor((monitorWidth - width) / 2)
  const y = top
    ? Math.trunc(monitor.y) + marginTop
    : Math.trunc(monitor.y) + monitorHeight - marginBottom - height
  return { x, y, width, height }
}

/**
 * Choose the bar size used for the reveal trigger.
 *
 * REQ-007: prefer the measured resting bar (S0 rail); the S1 window may be
 * much wider because it carries every option pill. `fallback` is the v0.2.2
 * window allocation, kept so a failed measurement degrades to the old region
 * instead of disabling the reveal.
 *
 * A cached measurement from ANOTHER monitor is never reused: each capture
 * window owns one monitor, and a stale rail rectangle from a different output
 * would trigger on the wrong screen. `null` means "no valid region".
 */
export function hoverBarSize(
  measured: HoverBarMeasurement | null,
  monitorConnector: string | null,
  fallback: HoverSize,
): HoverSize | null {
  if (
    measured !== null &&
    measured.connector !== null &&
    monitorConnector !== null &&
    measured.connector !== monitorConnector
  ) {
    return null
  }
  if (
    measured !== null &&
    finite(measured.width) &&
    finite(measured.height) &&
    Math.trunc(measured.width) > 0 &&
    Math.trunc(measured.height) > 0
  ) {
    return { width: Math.trunc(measured.width), height: Math.trunc(measured.height) }
  }
  if (
    finite(fallback.width) &&
    finite(fallback.height) &&
    Math.trunc(fallback.width) > 0 &&
    Math.trunc(fallback.height) > 0
  ) {
    return { width: Math.trunc(fallback.width), height: Math.trunc(fallback.height) }
  }
  return null
}

/**
 * Optional pointer-precision slack around the exact bar rect.
 *
 * REQ-007 defaults to 0 (literal bar rectangle). A future 1–4 px tweak must go
 * through this helper so the expansion is explicit and tested, never an
 * accidental full-width band.
 */
export function growHoverRect(
  rect: HoverRect | null,
  tolerance: number,
): HoverRect | null {
  if (rect === null) return null
  const amount =
    finite(tolerance) && tolerance > 0 ? Math.trunc(tolerance) : 0
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  }
}

/**
 * Inclusive-left/top, exclusive-right/bottom hit test.
 *
 * The right/bottom edges are exclusive because the window occupies
 * `[x, x + width)`: a pointer exactly at `x + width` is already past it. A
 * null point or rect is "unknown", never a hit.
 */
export function pointerInRegion(
  point: PointerPoint | null,
  region: HoverRect | null,
): boolean {
  if (point === null || region === null) return false
  return (
    point.x >= region.x &&
    point.x < region.x + region.width &&
    point.y >= region.y &&
    point.y < region.y + region.height
  )
}

/**
 * Arm-after-leave reveal state.
 *
 * `armed` starts false. A sample OUTSIDE the footprint arms the trigger and
 * hides; a sample INSIDE reveals only when armed. That gives:
 *
 *   start outside -> first outside sample arms, later enter reveals;
 *   start inside  -> no reveal until the pointer leaves once (CTA guard);
 *   leave         -> hide immediately but stay armed for the next enter.
 *
 * A null point/region (compositor missing, footprint not captured) always
 * hides and never reveals. It preserves `armed`, so a transient read failure
 * cannot turn into an accidental first-frame reveal; the next successful
 * outside sample can re-arm.
 */
export interface HoverRevealState {
  armed: boolean
  inside: boolean
  revealed: boolean
}

export function createHoverRevealState(): HoverRevealState {
  return { armed: false, inside: false, revealed: false }
}

export function updateHoverReveal(
  state: HoverRevealState,
  point: PointerPoint | null,
  region: HoverRect | null,
): HoverRevealState {
  if (point === null || region === null) {
    return { armed: state.armed, inside: false, revealed: false }
  }
  if (!pointerInRegion(point, region)) {
    return { armed: true, inside: false, revealed: false }
  }
  if (!state.armed) {
    return { armed: false, inside: true, revealed: false }
  }
  return { armed: true, inside: true, revealed: true }
}
