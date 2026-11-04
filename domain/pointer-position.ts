// ---------------------------------------------------------------------------
// DOMAIN: the compositor pointer position as plain data (REQ-006, SPIKE-001).
//
// The S4 `hover` reveal needs to know where the pointer is WITHOUT owning a
// mapped input surface. The compositor is the only source of global pointer
// position (GTK4 deliberately removed it; see `ports/monitor-focus.ts` for the
// measured API holes), so the adapter reads Hyprland and this module owns the
// shape and the tolerant parsing:
//
//   Hyprland command socket  -> "\n{\n  \"x\": 671,\n  \"y\": 788\n}\n"
//   hyprctl -j cursorpos     -> the same JSON, possibly with a warning line
//
// PURE: no Gio, no GLib, no I/O. An unreadable/corrupt response is `null`,
// which callers treat as "pointer unknown" — never as the origin.
// ---------------------------------------------------------------------------

export interface PointerPoint {
  x: number
  y: number
}

/**
 * Parse a Hyprland `cursorpos` payload.
 *
 * Accepts the JSON object Hyprland emits (and scans for the object because a
 * spawned `hyprctl` can prefix a warning). Returns null for anything without
 * two finite numbers, so a missing/broken compositor degrades to "unknown"
 * instead of a false `(0, 0)` that could reveal the HUD in the corner.
 */
export function parseCursorPosition(text: string): PointerPoint | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as {
      x?: unknown
      y?: unknown
    }
    if (typeof value?.x !== "number" || typeof value?.y !== "number") return null
    const x = value.x
    const y = value.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x, y }
  } catch {
    return null
  }
}
