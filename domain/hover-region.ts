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
//   barFootprint      the S1 surface rectangle in compositor coordinates,
//                     derived from the monitor geometry + the window's actual
//                     allocation at the moment the bar leaves S1. It is NOT a
//                     hardcoded 1546x54: target/options change the width, and
//                     top/bottom placement changes y.
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

function finite(value: number): boolean {
  return Number.isFinite(value)
}

/**
 * The S1 surface footprint in compositor logical coordinates.
 *
 * `monitor` and the returned rect use the same coordinate space as
 * `Gdk.Monitor.get_geometry()` + Hyprland `cursorpos` (both logical layout
 * pixels). The window is centred horizontally and anchored to one edge; its
 * allocation supplies both dimensions, so a wider/narrower S1 row follows
 * automatically. Invalid/zero geometry returns null (no region, no reveal)
 * rather than a rect at the origin.
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
