// ---------------------------------------------------------------------------
// UI: the ONE shared pending-selection controller behind the bar and every
// per-monitor `capture-overlay` window (REQ-003, design.md §4/§11.2).
//
// The bar owns keyboard/commit; the overlays own pointer/geometry. Both talk to
// this object, so there is exactly one pending selection and exactly one
// definition of "what is selected right now". It holds no widgets: overlay
// windows register a small host contract and are re-rendered by value.
//
// PURE ENOUGH TO EXECUTE IN NODE: no `ags/*`, no `gi://*`, no GTK runtime
// import. Types only. That is what lets `tests/ts/selection-session.test.ts`
// pin the Esc ladder, commit lock and INV-4 refresh survival without a display.
// ---------------------------------------------------------------------------

import type { MonitorDescriptor } from "../../domain/monitor-registry"
import type { ClientRect, PendingPick, Rect, Selection } from "../../domain/selection"
import { clientByAddress, hitClient } from "../../domain/selection"
import {
  beginSelection,
  canCommit,
  clearPending,
  commitSelection,
  emptySelection,
  retargetSelection,
  selectionOf,
  setPinnedWindow,
  setRegionRect,
  setScreenMonitor,
  type SelectionSession,
} from "../../domain/selection-session"
import type { BarMode } from "../../domain/bar-state"
import type { CaptureTarget } from "../../types"
import type { MonitorFocus } from "../../ports/monitor-focus"
import type { MonitorTopology } from "../../ports/monitor-topology"

/** What an overlay needs in order to paint one frame. */
export interface OverlayView {
  active: boolean
  mode: BarMode
  target: CaptureTarget
  pending: PendingPick
  /** Connector hosting the region pick (focused, else first monitor). */
  focused: string | null
  monitors: readonly MonitorDescriptor[]
  clients: readonly ClientRect[]
  hoverAddress: string | null
  pinned: ClientRect | null
  /** 1-based index of the pending screen pick in `monitors`. */
  monitorIndex: number
  monitorCount: number
}

/** The contract an overlay window registers. */
export interface OverlayHost {
  connector: string
  geometry: Rect
  setVisible: (visible: boolean) => void
  render: (view: OverlayView) => void
}

export interface SelectionControllerOptions {
  topology: MonitorTopology
  focus: MonitorFocus
  /** Fresh client rects (AstalHyprland in production, `[]` in tests). */
  clients: () => readonly ClientRect[]
}

export interface SelectionController {
  register(host: OverlayHost): void
  unregister(host: OverlayHost): void
  /** Open a mode's pending selection. */
  begin(mode: BarMode, target: CaptureTarget): void
  /** Leave the mode (back/Esc/commit); overlay disappears synchronously. */
  end(): void
  /** Palette refresh: re-render WITHOUT touching the session (INV-4). */
  refresh(): void
  retarget(target: CaptureTarget): void
  pending(): PendingPick
  session(): SelectionSession
  focused(): string | null
  monitors(): readonly MonitorDescriptor[]
  monitorIndex(connector: string | null): number
  setRect(rect: Rect | null): void
  pin(address: string | null): void
  /** Pin the client under a GLOBAL point, if any. */
  pinAt(x: number, y: number): void
  hoverAt(x: number, y: number): void
  leave(): void
  selectMonitor(connector: string): void
  cycleMonitor(): void
  canCommit(): boolean
  selection(): Selection | null
  /** Commit and lock; returns the finished selection, overlay hidden. */
  commit(): Selection | null
  /** Rung (a) of the Esc ladder; true means the bar should close the mode. */
  escape(): boolean
  /** Synchronous hide, idempotent; used by the FR-10 commit sequence. */
  hideNow(): void
}

export function createSelectionController(
  options: SelectionControllerOptions,
): SelectionController {
  const { topology, focus, clients } = options
  const hosts: OverlayHost[] = []
  let monitors: MonitorDescriptor[] = topology.list().map((entry) => entry.descriptor)
  let session: SelectionSession = emptySelection()
  let mode: BarMode = "screenshot"
  let hoverAddress: string | null = null

  function focusedConnector(): string | null {
    const reported = focus.focusedConnector()
    if (reported !== null) return reported
    // Deterministic fallback: registration order's first monitor. The overlay
    // must still have a region canvas even if the focus service is absent.
    return monitors.length > 0 ? (monitors[0].connector ?? null) : null
  }

  function monitorIndex(connector: string | null): number {
    if (connector === null) return 0
    const at = monitors.findIndex((monitor) => monitor.connector === connector)
    return at < 0 ? 0 : at + 1
  }

  function view(): OverlayView {
    const focused = focusedConnector()
    const list = clients()
    const pending = session.pending
    const selected =
      pending.target === "screen" ? (pending.monitor ?? focused) : null
    return {
      active: session.active,
      mode,
      target: session.target,
      pending,
      focused,
      monitors,
      clients: list,
      hoverAddress,
      pinned:
        pending.target === "window" ? clientByAddress(list, pending.address) : null,
      monitorIndex: monitorIndex(selected),
      monitorCount: monitors.length,
    }
  }

  function renderAll(): void {
    const current = view()
    for (const host of [...hosts]) {
      host.setVisible(
        current.active &&
          (current.target !== "region" || host.connector === current.focused),
      )
      host.render(current)
    }
  }

  topology.subscribe(() => {
    monitors = topology.list().map((entry) => entry.descriptor)
    renderAll()
  })
  focus.subscribe(() => renderAll())

  return {
    register(host): void {
      hosts.push(host)
      const current = view()
      host.setVisible(
        current.active &&
          (current.target !== "region" || host.connector === current.focused),
      )
      host.render(current)
    },
    unregister(host): void {
      const at = hosts.indexOf(host)
      if (at > -1) hosts.splice(at, 1)
    },
    begin(nextMode, target): void {
      mode = nextMode
      session = beginSelection(target)
      hoverAddress = null
      renderAll()
    },
    end(): void {
      session = emptySelection(session.target)
      hoverAddress = null
      renderAll()
    },
    refresh(): void {
      renderAll()
    },
    retarget(target): void {
      session = retargetSelection(session, target)
      hoverAddress = null
      renderAll()
    },
    pending(): PendingPick {
      return session.pending
    },
    session(): SelectionSession {
      return session
    },
    focused: focusedConnector,
    monitors(): readonly MonitorDescriptor[] {
      return monitors
    },
    monitorIndex,
    setRect(rect): void {
      session = setRegionRect(session, rect)
      renderAll()
    },
    pin(address): void {
      session = setPinnedWindow(session, address)
      renderAll()
    },
    pinAt(x, y): void {
      if (!session.active || session.target !== "window") return
      const client = hitClient(clients(), x, y)
      if (client === null) return
      session = setPinnedWindow(session, client.address)
      renderAll()
    },
    hoverAt(x, y): void {
      if (!session.active || session.target !== "window") return
      const client = hitClient(clients(), x, y)
      const next = client?.address ?? null
      if (next === hoverAddress) return
      hoverAddress = next
      renderAll()
    },
    leave(): void {
      if (hoverAddress === null) return
      hoverAddress = null
      renderAll()
    },
    selectMonitor(connector): void {
      session = setScreenMonitor(session, connector, focusedConnector())
      renderAll()
    },
    cycleMonitor(): void {
      if (!session.active || session.target !== "screen" || monitors.length === 0) return
      const focused = focusedConnector()
      const current =
        session.pending.target === "screen"
          ? (session.pending.monitor ?? focused)
          : focused
      const at = monitors.findIndex((monitor) => monitor.connector === current)
      const next = monitors[(at < 0 ? 0 : at + 1) % monitors.length]
      session = setScreenMonitor(session, next.connector, focused)
      renderAll()
    },
    canCommit(): boolean {
      return canCommit(session, focusedConnector())
    },
    selection(): Selection | null {
      return selectionOf(session, focusedConnector())
    },
    commit(): Selection | null {
      const result = commitSelection(session, focusedConnector())
      if (result.selection === null) return null
      session = result.session
      hoverAddress = null
      renderAll()
      return result.selection
    },
    escape(): boolean {
      const result = clearPending(session, focusedConnector())
      if (result.closed) return true
      session = result.session
      renderAll()
      return false
    },
    hideNow(): void {
      session = emptySelection(session.target)
      hoverAddress = null
      renderAll()
    },
  }
}
