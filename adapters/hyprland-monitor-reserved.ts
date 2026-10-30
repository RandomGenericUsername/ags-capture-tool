// ---------------------------------------------------------------------------
// ADAPTER: the compositor's reserved top zone, for top-placed bar margins
// (design.md D3/§11.4, REQ-002).
//
// PRIMARY: AstalHyprland's `Monitor.reserved_top`, read from the in-process
// service exactly like `hyprland-monitor-focus.ts`. The import is dynamic so a
// host without AstalHyprland still starts; a failure degrades to the fallback.
//
// FALLBACK: `hyprctl -j monitors` via a synchronous spawn, parsed by the pure
// `domain/monitor-reserved.ts`. The spawn is deliberately synchronous: placement
// is applied while the window is being mapped, and returning 0 because a promise
// has not settled would put the bar over ags-bar for a frame. The payload is a
// few KB and the call is made only on placement, never per frame.
//
// The value is the EXCLUSIVE zone, not this bar's own. This bar never sets
// EXCLUSIVE (design.md §11.4), so there is no self-offset feedback loop.
// ---------------------------------------------------------------------------

import GLib from "gi://GLib?version=2.0"
import type { MonitorReservedTop } from "../ports/monitor-reserved"
import { reservedTopFromHyprctl } from "../domain/monitor-reserved"

interface HyprlandMonitor {
  name: string
  reserved_top: number
}

interface HyprlandReservedSource {
  get_monitors(): HyprlandMonitor[]
  get_focused_monitor(): HyprlandMonitor | null
}

function readHyprctl(connector: string | null): number | null {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync("hyprctl -j monitors")
    if (!ok || stdout === null) return null
    return reservedTopFromHyprctl(new TextDecoder().decode(stdout), connector)
  } catch (error) {
    console.error(`capture-tool: cannot read hyprctl reserved zone: ${error}`)
    return null
  }
}

export function hyprlandMonitorReservedTop(): MonitorReservedTop {
  let source: HyprlandReservedSource | null = null

  void import("gi://AstalHyprland?version=0.1")
    .then(({ default: Hyprland }) => {
      source = Hyprland.get_default() as unknown as HyprlandReservedSource
    })
    .catch(() => {
      // No AstalHyprland on this host: the hyprctl fallback is the whole answer.
      source = null
    })

  return {
    reservedTop(connector: string | null): number {
      const monitors = source?.get_monitors() ?? []
      const monitor =
        (connector === null
          ? source?.get_focused_monitor() ?? undefined
          : monitors.find((entry) => entry.name === connector)) ?? null
      if (monitor !== null) {
        const value = monitor.reserved_top
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          return Math.max(0, Math.trunc(value))
        }
      }
      // MEASURED on this host: AstalHyprland 0.1 exposes the monitor but
      // reports `reserved_top = 0` while `hyprctl -j monitors` reports
      // [0, 48, 0, 0]. A zero is therefore treated as "not populated yet" and
      // the documented fallback supplies the real zone; geniunely bare-top
      // hosts still resolve to 0 because hyprctl reports 0 there too.
      return readHyprctl(connector) ?? 0
    },
  }
}
