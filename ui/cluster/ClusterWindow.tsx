// ---------------------------------------------------------------------------
// GTK: one capture-owned recording cluster window (SPIKE-003 option B).
//
// The bar owns the slot and sends it in monitor-local logical pixels. This
// window is created at exactly that slot, on the resolved monitor, above the
// bar, with no exclusive zone and no keyboard mode. Hiding destroys it; there
// is no mapped-but-transparent state.
//
// The buttons are presentation only. Pause/Resume/Stop route through the
// controller to `capture.state`; the bar never sends an action.
// ---------------------------------------------------------------------------

import { Astal, Gtk } from "ags/gtk4"
import type Gdk from "gi://Gdk?version=4.0"
import type { ClusterAnchor, ClusterLabels } from "ags-platform/ports/capture-cluster"
import {
  hudControlPlacement,
  hudTimer,
  pauseAction,
  pauseLabel,
  type RecordingHudState,
} from "../../domain/recording-hud"

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
  let row: Gtk.Box | null = null
  let dot: Gtk.Box | null = null
  let timer: Gtk.Label | null = null
  let status: Gtk.Button | null = null
  let actions: Gtk.Box | null = null
  let toggle: Gtk.Button | null = null
  let toggleLabel: Gtk.Label | null = null
  let stop: Gtk.Button | null = null
  let popup: Gtk.Popover | null = null
  let popupDot: Gtk.Box | null = null
  let popupStatus: Gtk.Label | null = null
  let popupToggle: Gtk.Button | null = null
  let popupToggleLabel: Gtk.Label | null = null
  let popupStop: Gtk.Button | null = null
  let currentCompact = false

  function applyLayout(anchor: ClusterAnchor): void {
    if (!window) return
    const width = Math.max(1, Math.round(anchor.width))
    const height = Math.max(1, Math.round(anchor.height))
    window.anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT
    window.margin_top = Math.round(anchor.y)
    window.margin_left = Math.round(anchor.x)
    window.set_size_request(width, height)
  }

  function setPaused(paused: boolean): void {
    for (const widget of [row, dot, popupDot, popup]) {
      if (!widget) continue
      if (paused) widget.add_css_class("paused")
      else widget.remove_css_class("paused")
    }
  }

  function openPopover(): void {
    if (!currentCompact || !popup) return
    options.onPopoverOpen()
    popup.popup()
  }

  function render(state: ClusterWindowState): void {
    const { hud, labels } = state
    const paused = hud.phase === "paused"
    currentCompact = state.compact

    if (timer) timer.set_label(hudTimer(hud, Date.now()))
    setPaused(paused)

    const placement = hudControlPlacement(state.compact)
    if (actions) actions.visible = placement.barControls
    if (!placement.popup) popup?.popdown()

    const toggleText = paused ? labels.resume : labels.pause
    if (toggleLabel) toggleLabel.set_label(toggleText)
    if (popupToggleLabel) popupToggleLabel.set_label(toggleText)
    if (popupStatus) popupStatus.set_label(paused ? labels.paused : labels.recording)
    if (stop) stop.set_sensitive(hud.jobId !== null)
    if (popupStop) popupStop.set_sensitive(hud.jobId !== null)
    if (toggle) toggle.set_sensitive(hud.jobId !== null)
    if (popupToggle) popupToggle.set_sensitive(hud.jobId !== null)
    if (status) status.set_tooltip_text(state.compact ? "Recording controls" : null)
  }

  function togglePause(): void {
    options.onToggle()
  }

  function stopRecording(): void {
    popup?.popdown()
    options.onStop()
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
      <box
        class="capture-cluster"
        orientation={Gtk.Orientation.HORIZONTAL}
        spacing={6}
        valign={Gtk.Align.CENTER}
        $={(self) => {
          row = self
        }}
      >
        <button
          class="hud-status"
          tooltipText="Recording controls"
          onClicked={openPopover}
          $={(self) => {
            status = self
          }}
        >
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
          >
            <box
              class="hud-dot"
              valign={Gtk.Align.CENTER}
              $={(self) => {
                dot = self
              }}
            />
            <label
              class="hud-timer"
              label="00:00"
              $={(self) => {
                timer = self
              }}
            />
          </box>
        </button>

        <box
          class="hud-actions"
          orientation={Gtk.Orientation.HORIZONTAL}
          spacing={6}
          $={(self) => {
            actions = self
          }}
        >
          <button
            class="bar-pill hud-toggle"
            tooltipText="Pause or resume the recording"
            onClicked={togglePause}
            $={(self) => {
              toggle = self
            }}
          >
            <label
              label="Pause"
              $={(self) => {
                toggleLabel = self
              }}
            />
          </button>
          <button
            class="bar-pill hud-stop"
            tooltipText="Stop recording"
            onClicked={stopRecording}
            $={(self) => {
              stop = self
            }}
          >
            <label label="⏹ Stop" />
          </button>
        </box>

        <popover
          $={(self) => {
            popup = self
            self.connect("closed", () => options.onPopoverClose())
          }}
        >
          <box class="hud-popup" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <box
              class="hud-popup-row"
              orientation={Gtk.Orientation.HORIZONTAL}
              spacing={8}
            >
              <box
                class="hud-dot"
                valign={Gtk.Align.CENTER}
                $={(self) => {
                  popupDot = self
                }}
              />
              <label
                label="Recording"
                $={(self) => {
                  popupStatus = self
                }}
              />
            </box>
            <box
              class="cluster-popup-actions"
              orientation={Gtk.Orientation.HORIZONTAL}
              homogeneous
              spacing={8}
            >
              <button
                class="cluster-popup-action"
                tooltipText="Pause or resume the recording"
                onClicked={togglePause}
                $={(self) => {
                  popupToggle = self
                }}
              >
                <box spacing={7}>
                  <image pixel_size={16} iconName="media-playback-pause-symbolic" />
                  <label
                    label="Pause"
                    $={(self) => {
                      popupToggleLabel = self
                    }}
                  />
                </box>
              </button>
              <button
                class="cluster-popup-action danger"
                tooltipText="Stop recording"
                onClicked={stopRecording}
                $={(self) => {
                  popupStop = self
                }}
              >
                <box spacing={7}>
                  <image pixel_size={16} iconName="media-playback-stop-symbolic" />
                  <label label="Stop" />
                </box>
              </button>
            </box>
          </box>
        </popover>
      </box>
    </window>
  ) as unknown as Astal.Window

  return {
    window: element,
    render,
    updateLayout(anchor: ClusterAnchor): void {
      applyLayout(anchor)
    },
    closePopover(): void {
      popup?.popdown()
    },
    openPopover,
    destroy(): void {
      popup?.popdown()
      element.destroy()
    },
  }
}
