// ---------------------------------------------------------------------------
// GTK: one capture-owned recording cluster window (SPIKE-003 option B).
//
// The bar owns the slot and sends it in monitor-local logical pixels. This
// window is created at exactly that slot, on the resolved monitor, above the
// bar, with no exclusive zone and no keyboard mode. Hiding destroys it; there
// is no mapped-but-transparent state.
//
// The card inside is the ONE shared `RecordingCluster` design, also used by
// the capture tool's own hover bar — the bar's accepted `.rec-*` look.
// ---------------------------------------------------------------------------

import { Astal, Gtk } from "ags/gtk4"
import type Gdk from "gi://Gdk?version=4.0"
import type { ClusterAnchor, ClusterLabels } from "ags-platform/ports/capture-cluster"
import type { RecordingHudState } from "../../domain/recording-hud"
import {
  RecordingCluster,
  type RecordingClusterHandle,
} from "../shared/recording-cluster"

export interface ClusterWindowState {
  hud: RecordingHudState
  labels: ClusterLabels
  compact: boolean
}

export interface ClusterWindowOptions {
  gdkmonitor: Gdk.Monitor
  anchor: ClusterAnchor
  onToggle: () => void
  onStop: () => void
  onPopoverOpen: () => void
  onPopoverClose: () => void
}

export interface ClusterWindowHandle {
  window: Astal.Window
  render(state: ClusterWindowState): void
  updateLayout(anchor: ClusterAnchor): void
  closePopover(): void
  openPopover(): void
  destroy(): void
}

export function ClusterWindow(options: ClusterWindowOptions): ClusterWindowHandle {
  let window: Astal.Window | null = null
  let currentAnchor = options.anchor
  const cluster: RecordingClusterHandle = RecordingCluster({
    onToggle: options.onToggle,
    onStop: options.onStop,
    onPopoverOpen: options.onPopoverOpen,
    onPopoverClose: options.onPopoverClose,
  })

  function applyLayout(anchor: ClusterAnchor): void {
    if (!window) return
    currentAnchor = anchor
    const width = Math.max(1, Math.round(anchor.width))
    const height = Math.max(1, Math.round(anchor.height))
    window.anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT
    window.margin_top = Math.round(anchor.y)
    window.margin_left = Math.round(anchor.x)
    // A mapped layer-shell surface does not shrink from a size-request alone;
    // re-assert the default size after the compact/full content has reflowed.
    window.set_size_request(width, height)
    window.set_default_size(width, height)
  }

  const element = (
    <window
      visible={false}
      name="capture-recording-cluster"
      class="capture-cluster-window"
      namespace="capture-cluster"
      gdkmonitor={options.gdkmonitor}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      halign={Gtk.Align.START}
      valign={Gtk.Align.START}
      margin_top={Math.round(options.anchor.y)}
      margin_left={Math.round(options.anchor.x)}
      $={(self) => {
        window = self
        applyLayout(options.anchor)
      }}
    >
      {cluster.element}
    </window>
  ) as unknown as Astal.Window

  return {
    window: element,
    render(state: ClusterWindowState): void {
      cluster.render({ hud: state.hud, labels: state.labels, compact: state.compact })
    },
    updateLayout(anchor: ClusterAnchor): void {
      applyLayout(anchor)
    },
    closePopover(): void {
      cluster.closePopover()
    },
    openPopover(): void {
      cluster.openPopover()
    },
    destroy(): void {
      cluster.destroy()
      element.destroy()
    },
  }
}
