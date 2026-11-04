// ---------------------------------------------------------------------------
// The ONE recording cluster design, shared by the top-bar overlay and the
// capture tool's own hover bar.
//
// It reproduces the bar's accepted `.rec-*` vocabulary — card, pulsing red dot,
// tabular timer, icon-only Pause/Play/Stop, and the popover — so there is no
// second HUD look. The top-bar window and the capture hover row both render
// this same element; only their outer window/visibility contract differs.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import { registry } from "ags-platform/adapters/icon-registry"
import type { ClusterLabels } from "ags-platform/ports/capture-cluster"
import {
  hudControlPlacement,
  hudTimer,
  pauseLabel,
  type RecordingHudState,
} from "../../domain/recording-hud"
import { appearanceRegistry } from "../appearance"

export interface RecordingClusterState {
  hud: RecordingHudState
  labels?: Partial<ClusterLabels>
  compact: boolean
}

export interface RecordingClusterOptions {
  onToggle: () => void
  onStop: () => void
  onPopoverOpen?: () => void
  onPopoverClose?: () => void
}

export interface RecordingClusterHandle {
  element: JSX.Element
  root: Gtk.Box
  popover: Gtk.Popover
  render(state: RecordingClusterState): void
  openPopover(): void
  closePopover(): void
  destroy(): void
}

interface ResolvedLabels extends ClusterLabels {}

const DEFAULT_LABELS: ResolvedLabels = {
  recording: "Recording",
  paused: "Recording paused",
  pause: "Pause",
  resume: "Resume",
  stop: "Stop",
}

type ClusterIcon = "pause" | "play" | "stop"

function iconPath(variant: ClusterIcon): string {
  return registry.resolve("capture-tool", variant) ?? ""
}

export function RecordingCluster(
  options: RecordingClusterOptions,
): RecordingClusterHandle {
  let root: Gtk.Box | null = null
  let dot: Gtk.Box | null = null
  let timer: Gtk.Label | null = null
  let status: Gtk.Button | null = null
  let inlineToggle: Gtk.Button | null = null
  let inlineStop: Gtk.Button | null = null
  let popover: Gtk.Popover | null = null
  let popupCard: Gtk.Box | null = null
  let popupDot: Gtk.Box | null = null
  let popupStatus: Gtk.Label | null = null
  let popupToggleLabel: Gtk.Label | null = null
  let popupStopLabel: Gtk.Label | null = null
  let popupToggleButton: Gtk.Button | null = null
  let popupStopButton: Gtk.Button | null = null
  let currentCompact = false
  let paused = false
  let labels: ResolvedLabels = DEFAULT_LABELS
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

  function setPaused(next: boolean): void {
    paused = next
    for (const widget of [root, dot, popupDot, popupCard]) {
      if (!widget) continue
      if (next) widget.add_css_class("paused")
      else widget.remove_css_class("paused")
    }
    refreshToggleIcons()
  }

  function openPopover(): void {
    if (!currentCompact || !popover) return
    options.onPopoverOpen?.()
    popover.popup()
  }

  function render(state: RecordingClusterState): void {
    labels = { ...DEFAULT_LABELS, ...(state.labels ?? {}) }
    currentCompact = state.compact
    setPaused(state.hud.phase === "paused")

    if (timer) timer.set_label(hudTimer(state.hud, Date.now()))
    if (inlineToggle) inlineToggle.visible = !state.compact
    if (inlineStop) inlineStop.visible = !state.compact
    if (!state.compact) popover?.popdown()

    if (popupStatus) {
      popupStatus.set_label(paused ? labels.paused : labels.recording)
    }
    if (popupToggleLabel) popupToggleLabel.set_label(paused ? labels.resume : labels.pause)
    if (popupStopLabel) popupStopLabel.set_label(labels.stop)

    const canControl = state.hud.jobId !== null
    if (inlineToggle) {
      inlineToggle.set_sensitive(canControl)
      inlineToggle.set_tooltip_text(paused ? "Resume recording" : "Pause recording")
    }
    if (inlineStop) inlineStop.set_sensitive(canControl)
    if (popupToggleButton) popupToggleButton.set_sensitive(canControl)
    if (popupStopButton) popupStopButton.set_sensitive(canControl)
    if (status) status.set_tooltip_text(state.compact ? "Recording controls" : null)
  }

  function stopRecording(): void {
    popover?.popdown()
    options.onStop()
  }

  const element = (
    <box
      class="rec-cluster"
      orientation={Gtk.Orientation.HORIZONTAL}
      $={(self) => {
        root = self
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
        onClicked={() => options.onToggle()}
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
        onClicked={stopRecording}
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
          popover = self
          self.connect("closed", () => options.onPopoverClose?.())
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
              onClicked={() => options.onToggle()}
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
  ) as unknown as JSX.Element

  const unregisterAppearance = appearanceRegistry.register({
    clearCaches(): void {
      for (const image of iconImages) image.set_from_file("")
    },
    rebuildIcons(): void {
      refreshIcons()
    },
    refreshWindow(): void {
      // The row is reflowed by GTK; the owning window re-asserts its own size.
    },
  })

  refreshIcons()

  const handle: RecordingClusterHandle = {
    element,
    get root(): Gtk.Box {
      if (!root) throw new Error("recording cluster root missing")
      return root
    },
    get popover(): Gtk.Popover {
      if (!popover) throw new Error("recording cluster popover missing")
      return popover
    },
    render,
    openPopover,
    closePopover(): void {
      popover?.popdown()
    },
    destroy(): void {
      unregisterAppearance()
      popover?.popdown()
    },
  }
  return handle
}
