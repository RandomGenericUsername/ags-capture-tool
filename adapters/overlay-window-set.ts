// ---------------------------------------------------------------------------
// ADAPTER: the per-monitor `capture-overlay` window set (design.md §11.2).
//
// This is deliberately a SECOND, much simpler set than
// `monitor-window-set.ts`: that one owns the bar's focused-monitor visibility
// policy (D2). Overlay visibility is selection-driven (region: the hosting
// monitor; window/screen: every monitor), and is applied by the selection
// controller, so this adapter only mirrors the topology: build one overlay per
// monitor, destroy it when the monitor goes away, and never recreate a window
// for a refresh.
//
// The window factory is injected exactly like the bar's, so this file does not
// import a layout. The overlay component registers/unregisters itself with the
// controller from its own `destroy` handler, which is what keeps a removed
// monitor out of the next render.
// ---------------------------------------------------------------------------

import type { Gdk, Gtk } from "ags/gtk4"
import type { WindowBinding } from "../domain/monitor-registry"
import { monitorKey, planSync } from "../domain/monitor-registry"
import type { MonitorTopology } from "../ports/monitor-topology"

type AppWindowHost = {
  add_window(window: Gtk.Window): void
  remove_window(window: Gtk.Window): void
}

export interface OverlayWindowSetOptions {
  app: AppWindowHost
  topology: MonitorTopology
  /** Builds one overlay window for a monitor. Injected layout seam. */
  createWindow: (monitor: Gdk.Monitor) => Gtk.Window
  report?: (message: string) => void
}

export interface OverlayWindowSet {
  bindings(): readonly WindowBinding<Gtk.Window>[]
  dispose(): void
}

type OverlayWindow = Gtk.Window & { destroy(): void }

export function createOverlayWindowSet(options: OverlayWindowSetOptions): OverlayWindowSet {
  const { app, topology, createWindow, report } = options
  const bindings: WindowBinding<OverlayWindow>[] = []

  function reconcile(): void {
    const entries = topology.list()
    const plan = planSync(bindings, entries.map((entry) => entry.descriptor))
    for (const descriptor of plan.create) {
      const entry = entries.find((e) => monitorKey(e.descriptor) === monitorKey(descriptor))
      const monitor = entry?.native as Gdk.Monitor | undefined
      if (!monitor) continue
      const window = createWindow(monitor) as OverlayWindow
      bindings.push({ key: monitorKey(descriptor), window })
      app.add_window(window)
      report?.(`capture: opened an overlay for monitor ${descriptor.connector ?? "(unnamed)"}`)
    }
    for (const stale of plan.destroy) {
      // Same order as the bar's window set: remove from the application's
      // list first (so a name lookup cannot resolve a dying window), then
      // destroy (which unregisters the overlay host and its appearance
      // surface from their registries).
      app.remove_window(stale.window)
      const at = bindings.indexOf(stale)
      if (at > -1) bindings.splice(at, 1)
      stale.window.destroy()
      report?.("capture: destroyed an overlay for a monitor that went away")
    }
  }

  topology.subscribe(reconcile)
  reconcile()

  return {
    bindings: () => bindings,
    dispose(): void {
      // The topology subscription is owned by the topology adapter, as with
      // the bar window set. Kept as a seam for a future detachable topology.
    },
  }
}
