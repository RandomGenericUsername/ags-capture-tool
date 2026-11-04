// ---------------------------------------------------------------------------
// PORT: the global pointer position (REQ-006, SPIKE-001 option C).
//
// GTK4 cannot answer this: the same measured API holes that forced
// `ports/monitor-focus.ts` to the compositor apply here (`Gdk.Device.
// get_position` and `Gdk.Display.get_monitor_at_point` are absent, and
// `get_surface_at_position()` returns NULL whenever another client owns the
// pointer). The compositor already exposes it; this port keeps the S4 code
// free of Hyprland specifics.
//
// Reads are synchronous because the caller is a 10-20 Hz GLib timeout and the
// measured socket query is sub-millisecond. `null` is a NORMAL answer: no
// Hyprland, no socket, a malformed reply, or a host without the command. It
// never throws, so a missing compositor degrades to "no reveal", not a crash.
// ---------------------------------------------------------------------------

import type { PointerPoint } from "../domain/pointer-position"

export interface PointerPosition {
  /** Current pointer position in logical compositor coordinates, or null. */
  current(): PointerPoint | null
}
