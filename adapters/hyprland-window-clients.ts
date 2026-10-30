// ---------------------------------------------------------------------------
// ADAPTER: AstalHyprland client rects for the window picker (REQ-003 §11.2).
//
// WHY THE COMPOSITOR: GTK4 deliberately removed global pointer/focus APIs, and
// the backend already resolves window geometry from `hyprctl -j clients`.
// AstalHyprland exposes the same data in-process, including the address the
// backend will resolve at commit time (D8).
//
// WHY DYNAMIC IMPORT: a host without AstalHyprland must still start the bar;
// a rejected import degrades to "no client rects", which only disables the
// hover ring — the region and screen paths are unaffected.
//
// The list is re-read on every call (pointer motion / click), so a moved or
// vanished window is never served from a stale snapshot. `subscribe` exists for
// structural changes that should repaint immediately (client added/removed).
// ---------------------------------------------------------------------------

import type { ClientRect } from "../domain/selection"
import type { WindowClients } from "../ports/window-clients"

interface HyprlandClient {
  address?: string
  title?: string
  class?: string
  x?: number
  y?: number
  width?: number
  height?: number
  mapped?: boolean
  hidden?: boolean
  monitor?: { name?: string } | null
}

interface HyprlandClientsSource {
  clients?: HyprlandClient[]
  connect?(signal: string, callback: () => void): number
}

export function hyprlandWindowClients(): WindowClients {
  let source: HyprlandClientsSource | null = null
  const listeners: Array<() => void> = []
  const notify = () => {
    for (const listener of listeners) listener()
  }

  void import("gi://AstalHyprland?version=0.1")
    .then(({ default: Hyprland }) => {
      source = Hyprland.get_default() as unknown as HyprlandClientsSource
      try {
        source.connect?.("notify::clients", notify)
      } catch {
        // No push: pointer motion still re-reads the list.
      }
      notify()
    })
    .catch(() => {
      // Documented degradation: no compositor client data, no window picker.
      source = null
    })

  return {
    list(): ClientRect[] {
      const clients = source?.clients ?? []
      const rects: ClientRect[] = []
      for (const client of clients) {
        if (client.mapped === false || client.hidden === true) continue
        const address = client.address ?? ""
        const x = client.x
        const y = client.y
        const width = client.width
        const height = client.height
        if (!address || x === undefined || y === undefined) continue
        if (width === undefined || height === undefined || width <= 0 || height <= 0) continue
        rects.push({
          address,
          title: client.title || client.class || "window",
          appClass: client.class ?? "",
          monitor: client.monitor?.name ?? null,
          rect: { x, y, width, height },
        })
      }
      return rects
    },
    subscribe(onChange: () => void): void {
      listeners.push(onChange)
    },
  }
}
