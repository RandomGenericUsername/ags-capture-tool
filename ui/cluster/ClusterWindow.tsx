// ---------------------------------------------------------------------------
// GTK: one capture-owned recording cluster window (SPIKE-003 option B).
//
// The bar owns the slot and sends it in monitor-local logical pixels. This
// window is created at exactly that slot, on the resolved monitor, above the
// bar, with no exclusive zone and no keyboard mode. Hiding destroys it; there
// is no mapped-but-transparent state.
//
// VISUAL CONTRACT: this intentionally reproduces the bar's old recording
// indicator (`rec-cluster`, `rec-dot`, `rec-timer`, `rec-btn`, `rec-popup`) —
// that is the design JD accepted. Capture owns the rendering and controls; the
// bar only reserves the same-sized slot.
// ---------------------------------------------------------------------------

import { Astal, Gtk } from "ags/gtk4"
import type Gdk from "gi://Gdk?version=4.0"
import { registry } from "ags-platform/adapters/icon-registry"
import type { ClusterAnchor, ClusterLabels } from "ags-platform/ports/capture-cluster"
import {
  hudControlPlacement,
  hudTimer,
  type RecordingHudState,
} from "../../domain/recording-hud"
import { appearanceRegistry } from "../appearance"

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

type ClusterIcon = "pause" | "play" | "stop"

function iconPath(variant: ClusterIcon): string {
  return registry.resolve("capture-tool", variant) ?? ""
}

export function ClusterWindow(options: ClusterWindowOptions): ClusterWindowHandle {
  let window: Astal.Window | null = null
  let card: Gtk.Box | null = null
  let dot: Gtk.Box | null = null
  let timer: Gtk.Label | null = null
  let status: Gtk.Button | null = null
  let inlineToggle: Gtk.Button | null = null
  let inlineStop: Gtk.Button | null = null
  let popup: Gtk.Popover | null = null
  let popupCard: Gtk.Box | null = null
  let popupDot: Gtk.Box | null = null
  let popupStatus: Gtk.Label | null = null
  let popupToggleLabel: Gtk.Label | null = null
  let popupStopLabel: Gtk.Label | null = null
  let popupToggleButton: Gtk.Button | null = null
  let popupStopButton: Gtk.Button | null = null
  let currentCompact = false
  let paused = false
  let currentAnchor = options.anchor
  const iconImages: Gtk.Image[] = []
  let inlineToggleImage: Gtk.Image | null = null
  let inlineStopImage: Gtk.Image | null = null
  let popupToggleImage: Gtk.Image | null = null
  let popupStopImage: Gtk.Image | null = null

  function refreshToggleIcons(): void {
    const path = iconPath(paused ? "play" : "pause")
    inlineToggleImage?.set_from_file(path)
    popupToggleImage?.set_from_file(path)
  }

  function refreshStopIcons(): void {
    const path = iconPath("stop")
    inlineStopImage?.set_from_file(path)
    popupStopImage?.set_from_file(path)
  }

  function refreshIcons(): void {
    refreshToggleIcons()
    refreshStopIcons()
  }

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

  function setPaused(next: boolean): void {
    paused = next
    for (const widget of [card, dot, popupDot, popupCard]) {
      if (!widget) continue
      if (next) widget.add_css_class("paused")
      else widget.remove_css_class("paused")
    }
    refreshToggleIcons()
  }

  function openPopover(): void {
    if (!currentCompact || !popup) return
    options.onPopoverOpen()
    popup.popup()
  }

  function render(state: ClusterWindowState): void {
    const { hud, labels } = state
    currentCompact = state.compact
    setPaused(hud.phase === "paused")

    if (timer) timer.set_label(hudTimer(hud, Date.now()))
    if (inlineToggle) inlineToggle.visible = !state.compact
    if (inlineStop) inlineStop.visible = !state.compact
    if (!state.compact) popup?.popdown()

    const toggleText = paused ? labels.resume : labels.pause
    if (popupStatus) {
      popupStatus.set_label(paused ? labels.paused : labels.recording)
    }
    if (popupToggleLabel) popupToggleLabel.set_label(toggleText)
    if (popupStopLabel) popupStopLabel.set_label(labels.stop)

    const canControl = hud.jobId !== null
    if (inlineToggle) inlineToggle.set_sensitive(canControl)
    if (inlineStop) inlineStop.set_sensitive(canControl)
    if (popupToggleButton) popupToggleButton.set_sensitive(canControl)
    if (popupStopButton) popupStopButton.set_sensitive(canControl)
    if (status) status.set_tooltip_text(state.compact ? "Recording controls" : null)
    if (inlineToggle) {
      inlineToggle.set_tooltip_text(paused ? "Resume recording" : "Pause recording")
    }
  }

  function togglePause(): void {
    options.onToggle()
  }

  function stopRecording(): void {
    popup?.popdown()
    options.onStop()
  }

  function onInlineToggle(): void {
    options.onToggle()
  }

  function onInlineStop(): void {
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
        class="rec-cluster"
        orientation={Gtk.Orientation.HORIZONTAL}
        $={(self) => {
          card = self
        }}
      >
        <button
          class="rec-status"
          onClicked={openPopover}
          $={(self) => {
            status = self
          }}
        >
          <box spacing={6}>
            <box
              class="rec-dot"
              valign={Gtk.Align.CENTER}
              $={(self) => {
                dot = self
              }}
            />
            <label
              class="rec-timer"
              label="00:00"
              $={(self) => {
                timer = self
              }}
            />
          </box>
        </button>

        <button
          class="rec-btn"
          visible={false}
          onClicked={onInlineToggle}
          $={(self) => {
            inlineToggle = self
          }}
        >
          <image
            pixel_size={16}
            $={(self) => {
              inlineToggleImage = self
              iconImages.push(self)
            }}
          />
        </button>

        <button
          class="rec-btn stop"
          visible={false}
          onClicked={onInlineStop}
          $={(self) => {
            inlineStop = self
          }}
        >
          <image
            pixel_size={16}
            $={(self) => {
              inlineStopImage = self
              iconImages.push(self)
            }}
          />
        </button>

        <popover
          $={(self) => {
            popup = self
            self.connect("closed", () => options.onPopoverClose())
          }}
        >
          <box
            orientation={Gtk.Orientation.VERTICAL}
            class="rec-popup"
            $={(self) => {
              popupCard = self
            }}
          >
            <box class="rec-popup-row" spacing={8}>
              <box
                class="rec-dot"
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
            <box class="rec-popup-actions" homogeneous spacing={8}>
              <button
                class="rec-popup-action"
                onClicked={togglePause}
                $={(self) => {
                  popupToggleButton = self
                }}
              >
                <box spacing={7}>
                  <image
                    pixel_size={16}
                    $={(self) => {
                      popupToggleImage = self
                      iconImages.push(self)
                    }}
                  />
                  <label
                    label="Pause"
                    $={(self) => {
                      popupToggleLabel = self
                    }}
                  />
                </box>
              </button>
              <button
                class="rec-popup-action danger"
                onClicked={stopRecording}
                $={(self) => {
                  popupStopButton = self
                }}
              >
                <box spacing={7}>
                  <image
                    pixel_size={16}
                    $={(self) => {
                      popupStopImage = self
                      iconImages.push(self)
                    }}
                  />
                  <label
                    label="Stop"
                    $={(self) => {
                      popupStopLabel = self
                    }}
                  />
                </box>
              </button>
            </box>
          </box>
        </popover>
      </box>
    </window>
  ) as unknown as Astal.Window

  const unregisterAppearance = appearanceRegistry.register({
    clearCaches(): void {
      for (const image of iconImages) image.set_from_file("")
    },
    rebuildIcons(): void {
      refreshIcons()
    },
    refreshWindow(): void {
      applyLayout(currentAnchor)
    },
  })

  refreshIcons()

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
      unregisterAppearance()
      popup?.popdown()
      element.destroy()
    },
  }
}
