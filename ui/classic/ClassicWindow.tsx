// ---------------------------------------------------------------------------
// CAPTURE BAR — the per-monitor window shell (design.md §3/§5, REQ-002).
//
// This file used to be the centred three-page panel. It is now the small state
// machine the design specifies: S0 is an icon-only rail; S1 is one mode open
// with its option pills and a CTA. REQ-003/REQ-004 add the pending overlay and
// S4 live HUD on top of these states; this shell deliberately stops at S1 and
// leaves the legacy backend commit path in place for this ticket.
//
// The window remains ONE live window per monitor, named `capture-window`, with
// the same appearance-registry contract. Focus changes are handled by
// `adapters/monitor-window-set.ts`: only the focused monitor's window is
// visible, and a focus change re-maps visibility without destroying a window or
// resetting the shared `UiState`.
// ---------------------------------------------------------------------------

import { Astal, Gdk, Gtk } from "ags/gtk4"
import { barMarginTop } from "../../domain/bar-placement"
import {
  back,
  enterAction,
  homeBar,
  isModeOpen,
  isSettingsOpen,
  openMode,
  openSettings,
  type BarState,
  type BarMode,
} from "../../domain/bar-state"
import { recordingArgs, screenshotArgs } from "../../domain/cli-args"
import type { RecordingRequest, ScreenshotRequest } from "../../domain/capture-request"
import type { CaptureSettings } from "../../domain/settings"
import { runCommit } from "../../lib/commit-order"
import type { SelectionController } from "../overlay/controller"
import { configDefaults, durationSelection, type UiState } from "../../domain/ui-state"
import type { CapturePorts } from "../../ports/capture-ports"
import type {
  AudioSource,
  CaptureTarget,
  GifScale,
  RecordingFormat,
  RecordingQuality,
  ScreenshotFormat,
} from "../../types"
import { applyGroup } from "../shared/groups"
import { createIconSlots, withIcon } from "../shared/icons"
import { appearanceRegistry } from "../appearance"
import { RecordingPage, type RecordingPageHandle } from "./RecordingPage"
import { ScreenshotPage, type ScreenshotPageHandle } from "./ScreenshotPage"
import { SettingsPage, type SettingsPageHandle } from "./SettingsPage"

// The name is the window's PUBLIC identity, and it is deliberately NOT unique:
// `style.css` selects the surface with `window#capture-window` and the
// provisioned `capture-ui` launcher toggles it by that name. See
// `tests/ts/window-identity.test.ts` for the full consumer list.
const WINDOW_NAME = "capture-window"

export function ClassicWindow(
  gdkmonitor: Gdk.Monitor,
  ports: CapturePorts,
  state: UiState,
  selection: SelectionController,
): Astal.Window {
  const { settingsStore, uiStateStore, launcher, monitorReservedTop } = ports

  const initialSettings = settingsStore.load()
  const initialTop = initialSettings.bar.position === "top"
  const initialMargin = initialTop
    ? barMarginTop(
        initialSettings.bar.position,
        monitorReservedTop.reservedTop(gdkmonitor.get_connector()),
        initialSettings.bar.offsetPx,
      )
    : 0

  // The S0/S1 surface machine. S2/S3/S4 are REQ-003/REQ-004; keeping this state
  // pure (`domain/bar-state.ts`) is the seam they extend.
  let barState: BarState = homeBar()
  let config: CaptureSettings = initialSettings

  // THIS window, captured from its own `<window>` `$` handler rather than
  // looked up by name (fix-capture-window-identity).
  let captureWindow: Astal.Window | null = null
  const iconSlots = createIconSlots()
  let unregisterAppearance: (() => void) | null = null

  function hideCaptureWindow() {
    if (captureWindow) captureWindow.visible = false
  }

  /** Re-assert the layer-surface size after a state switch. */
  function syncWindowSize() {
    const window = captureWindow
    const panel = window?.get_child()
    if (!window || !panel) return
    const [, width] = panel.measure(Gtk.Orientation.HORIZONTAL, -1)
    const [, height] = panel.measure(Gtk.Orientation.VERTICAL, width)
    window.set_default_size(width, height)
  }

  /**
   * Apply `bar.position` / `bar.offsetPx`.
   *
   * Top margin is `reserved_top + offsetPx`; bottom keeps the edge margin at 0.
   * The window is never EXCLUSIVE, so this value cannot feed back into the
   * compositor's own reserved zone (design.md §11.4).
   */
  function applyPlacement() {
    const window = captureWindow
    if (!window) return
    config = settingsStore.load()
    const top = config.bar.position === "top"
    const reserved = top ? monitorReservedTop.reservedTop(gdkmonitor.get_connector()) : 0
    const margin = barMarginTop(config.bar.position, reserved, config.bar.offsetPx)
    window.anchor = top ? Astal.WindowAnchor.TOP : Astal.WindowAnchor.BOTTOM
    window.valign = top ? Gtk.Align.START : Gtk.Align.END
    window.margin_top = margin
    window.margin_bottom = 0
    syncWindowSize()
  }

  // Widget handles. The three S0 rail buttons, the S1 row and the settings page
  // are built once; state changes only toggle visibility and classes.
  let rail: Gtk.Box | null = null
  let openRow: Gtk.Box | null = null
  let screenshotTab: Gtk.Button | null = null
  let recordingTab: Gtk.Button | null = null
  let cta: Gtk.Button | null = null
  let ctaLabel: Gtk.Label | null = null
  let screenshotPage: ScreenshotPageHandle | null = null
  let recordingPage: RecordingPageHandle | null = null
  let settingsPage: SettingsPageHandle | null = null

  const { screenshot, recording } = state

  const screenshotTargetGroup: Array<{ value: CaptureTarget; button: Gtk.Button }> = []
  const screenshotDelayGroup: Array<{ value: number; button: Gtk.Button }> = []
  const screenshotFormatGroup: Array<{ value: ScreenshotFormat; button: Gtk.Button }> = []
  const screenshotOutputGroup: Array<{ value: boolean; button: Gtk.Button }> = []
  const screenshotCursorGroup: Array<{ value: boolean; button: Gtk.Button }> = []
  const recordingTargetGroup: Array<{ value: CaptureTarget; button: Gtk.Button }> = []
  const recordingFpsGroup: Array<{ value: number; button: Gtk.Button }> = []
  const recordingGifFpsGroup: Array<{ value: number; button: Gtk.Button }> = []
  const recordingFormatGroup: Array<{ value: RecordingFormat; button: Gtk.Button }> = []
  const recordingAudioGroup: Array<{ value: AudioSource; button: Gtk.Button }> = []
  const recordingQualityGroup: Array<{ value: RecordingQuality; button: Gtk.Button }> = []
  const recordingDurationGroup: Array<{ value: number; button: Gtk.Button }> = []
  const recordingSizeGroup: Array<{ value: GifScale; button: Gtk.Button }> = []
  const recordingCursorGroup: Array<{ value: boolean; button: Gtk.Button }> = []

  function currentTarget(): CaptureTarget {
    return barState.view === "recording" ? recording.target : screenshot.target
  }

  /**
   * Keep the bar's commit affordance and `Monitor n` chip in step with the
   * pending selection. The overlay itself is rendered by the controller; this
   * only mirrors "can commit?" and the screen target's monitor identity.
   */
  function syncSelectionUi() {
    const modeOpen = isModeOpen(barState)
    if (cta) cta.sensitive = modeOpen && selection.canCommit()
  }

  /** Translate the pure bar state into the built widget tree. */
  function applyBarState() {
    const modeOpen = isModeOpen(barState)
    if (rail) rail.visible = barState.view === "home"
    if (openRow) openRow.visible = modeOpen
    if (screenshotPage) screenshotPage.setVisible(barState.view === "screenshot")
    if (recordingPage) recordingPage.setVisible(barState.view === "recording")
    if (settingsPage) {
      const settingsOpen = isSettingsOpen(barState)
      settingsPage.setVisible(settingsOpen)
      if (settingsOpen) settingsPage.render()
    }
    if (screenshotTab) {
      if (barState.view === "screenshot") screenshotTab.add_css_class("active")
      else screenshotTab.remove_css_class("active")
    }
    if (recordingTab) {
      if (barState.view === "recording") recordingTab.add_css_class("active")
      else recordingTab.remove_css_class("active")
    }
    if (cta && ctaLabel) {
      const recordingMode = barState.view === "recording"
      ctaLabel.set_label(recordingMode ? "Record" : "Capture")
      if (recordingMode) cta.add_css_class("record")
      else cta.remove_css_class("record")
    }
    syncSelectionUi()
    syncWindowSize()
  }

  function selectMode(next: BarMode) {
    const wasOpen = barState.view === next
    barState = openMode(barState, next)
    // Entering a lane engages its pending selection immediately (S1 -> S2).
    // Re-tapping the active lane keeps the current pending object.
    if (!wasOpen) selection.begin(next, currentTarget())
    applyBarState()
  }

  function openSettingsView() {
    selection.end()
    barState = openSettings(barState)
    applyBarState()
  }

  function returnHome() {
    selection.end()
    barState = back(barState)
    applyBarState()
  }

  function targetChanged() {
    if (!isModeOpen(barState)) return
    selection.retarget(currentTarget())
    applyBarState()
  }

  function closeSettings() {
    if (settingsPage !== null && !settingsPage.close()) return
    returnHome()
  }

  function setScreenshotCursor(value: boolean) {
    config = { ...config, screenshot: { ...config.screenshot, cursor: value } }
    const error = settingsStore.save(config)
    if (error !== null) console.error(`capture-tool: cannot save cursor setting: ${error}`)
    applyGroup(screenshotCursorGroup, value)
  }

  function setRecordingCursor(value: boolean) {
    config = { ...config, recording: { ...config.recording, cursor: value } }
    const error = settingsStore.save(config)
    if (error !== null) console.error(`capture-tool: cannot save cursor setting: ${error}`)
    applyGroup(recordingCursorGroup, value)
  }

  /**
   * Commit is a ONE-WAY DOOR (D6): the pending selection is snapshotted, the
   * session locks inactive, the overlay + bar hide SYNCHRONOUSLY, and only then
   * does the launcher receive argv (FR-10). There is no post-commit editing
   * state; the bar returns to S0 so the next open starts from a fresh session.
   *
   * The legacy interactive backend path (no geometry/reference flags) is still
   * available to CLI users, but this UI never calls it: every request carries
   * the finished `Selection`.
   */
  function commitCurrentMode() {
    const finished = selection.selection()
    if (finished === null) return
    uiStateStore.save(screenshot, recording)
    const current = settingsStore.load()
    const argv =
      barState.view === "recording"
        ? recordingArgs({
            target: recording.target,
            fps: recording.fps,
            gifFps: recording.gifFps,
            format: recording.format,
            audio: recording.audio,
            quality: recording.quality,
            duration: recording.duration,
            size: recording.size,
            cursor: current.recording.cursor,
            selection: finished,
          } satisfies RecordingRequest)
        : screenshotArgs({
            target: screenshot.target,
            delay: screenshot.delay,
            format: screenshot.format,
            save: screenshot.save,
            cursor: current.screenshot.cursor,
            selection: finished,
          } satisfies ScreenshotRequest)

    runCommit({
      // The controller clears the rect/pin and hides every overlay window
      // synchronously. `commit()` is idempotent from this call site: it
      // returns the same finished selection that argv was built from.
      hideOverlay: () => {
        selection.commit()
      },
      hideBar: () => {
        barState = homeBar()
        applyBarState()
        hideCaptureWindow()
      },
      launch: () => launcher.launch(argv),
    })
  }

  function onKey(keyval: number): boolean {
    if (keyval === Gdk.KEY_Escape) {
      // An open inline path editor owns Escape (cancel the edit).
      if (isSettingsOpen(barState) && settingsPage !== null && settingsPage.cancelPathEditor()) {
        return true
      }
      // Pending selection ladder (design.md §4.7): first clear the pick and
      // keep the mode open; only the next press closes the mode. Enter never
      // participates in this ladder.
      if (isModeOpen(barState)) {
        if (selection.escape()) returnHome()
        else applyBarState()
        return true
      }
      // Settings -> S0, then S0 -> hide the bar.
      if (barState.view !== "home") returnHome()
      else {
        selection.end()
        hideCaptureWindow()
      }
      return true
    }
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      // An open inline path editor owns Enter (commit the edit).
      if (isSettingsOpen(barState) && settingsPage !== null && settingsPage.commitPathEditor()) {
        return true
      }
      const action = enterAction(barState)
      if (action === "settings") closeSettings()
      else if (action === "screenshot" || action === "recording") commitCurrentMode()
      return true
    }
    return false
  }

  function applyStateToUi() {
    // Last-used UI state > settings defaults > hardcoded constants.
    const loaded = uiStateStore.load(configDefaults(settingsStore.load()))
    Object.assign(screenshot, loaded.screenshot)
    Object.assign(recording, loaded.recording)
    config = settingsStore.load()
    applyGroup(screenshotTargetGroup, screenshot.target)
    applyGroup(screenshotDelayGroup, screenshot.delay)
    applyGroup(screenshotFormatGroup, screenshot.format)
    applyGroup(screenshotOutputGroup, screenshot.save)
    applyGroup(screenshotCursorGroup, config.screenshot.cursor)
    applyGroup(recordingTargetGroup, recording.target)
    applyGroup(recordingFpsGroup, recording.fps)
    applyGroup(recordingGifFpsGroup, recording.gifFps)
    applyGroup(recordingFormatGroup, recording.format)
    applyGroup(recordingAudioGroup, recording.audio)
    applyGroup(recordingQualityGroup, recording.quality)
    applyGroup(recordingDurationGroup, durationSelection(recording))
    applyGroup(recordingSizeGroup, recording.size)
    applyGroup(recordingCursorGroup, config.recording.cursor)
    // Groups, then the spin, then the conditional rows — the recording page's
    // own order, unchanged from the old panel.
    if (recordingPage) recordingPage.applyState()
  }

  function settingsChanged() {
    applyPlacement()
    config = settingsStore.load()
    applyGroup(screenshotCursorGroup, config.screenshot.cursor)
    applyGroup(recordingCursorGroup, config.recording.cursor)
  }

  return (
    <window
      visible={false}
      name="capture-window"
      class="capture-window"
      namespace="capture"
      gdkmonitor={gdkmonitor}
      anchor={initialTop ? Astal.WindowAnchor.TOP : Astal.WindowAnchor.BOTTOM}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      // NEVER EXCLUSIVE: the bar reads reserved_top for its own margin, so
      // claiming an exclusive zone would feed back into that measurement.
      exclusivity={Astal.Exclusivity.IGNORE}
      halign={Gtk.Align.CENTER}
      valign={initialTop ? Gtk.Align.START : Gtk.Align.END}
      margin_top={initialMargin}
      $={(self) => {
        captureWindow = self
        // Non-destructive palette refresh surface, unchanged contract: clear the
        // built icon images, rebuild them, re-measure the surface. Nothing here
        // touches visibility, the bar state, the settings draft or `state`.
        unregisterAppearance = appearanceRegistry.register({
          clearCaches: () => iconSlots.clear(),
          rebuildIcons: () => iconSlots.refresh(),
          refreshWindow: syncWindowSize,
        })
        self.connect("destroy", () => {
          if (unregisterAppearance !== null) {
            unregisterAppearance()
            unregisterAppearance = null
          }
        })
        // Capture phase so Enter/Escape fire even when a pill has focus.
        const keys = new Gtk.EventControllerKey()
        keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
        keys.connect("key-pressed", (_controller, keyval, _keycode, _state) => onKey(keyval))
        self.add_controller(keys)
        self.connect("map", () => {
          applyStateToUi()
          applyPlacement()
          applyBarState()
          // ON_DEMAND never steals the keyboard from other AGS windows.
          self.present()
        })
      }}
    >
      <centerbox class="capture-root">
        <box
          $type="center"
          class="capture-shell"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={0}
        >
          {/* --------------------------------------------------------- S0 */}
          <box
            class="capture-bar rail"
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={4}
            $={(self) => {
              rail = self
            }}
          >
            <button
              class="railicon"
              tooltipText="Screenshot"
              onClicked={() => selectMode("screenshot")}
            >
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                $={withIcon("camera", 18, iconSlots)}
              />
            </button>
            <button
              class="railicon"
              tooltipText="Recording"
              onClicked={() => selectMode("recording")}
            >
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                $={withIcon("video", 18, iconSlots)}
              />
            </button>
            <button
              class="railicon"
              tooltipText="Capture settings"
              onClicked={openSettingsView}
            >
              <label label="⚙" />
            </button>
          </box>

          {/* ------------------------------------------- S1 (one mode open) */}
          <box
            visible={false}
            class="capture-bar open"
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            $={(self) => {
              openRow = self
            }}
          >
            <button class="bar-back" tooltipText="Back" onClicked={returnHome}>
              <label label="←" />
            </button>
            <button
              class="railicon"
              tooltipText="Screenshot"
              onClicked={() => selectMode("screenshot")}
              $={(self) => {
                screenshotTab = self
              }}
            >
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                $={withIcon("camera", 18, iconSlots)}
              />
            </button>
            <button
              class="railicon"
              tooltipText="Recording"
              onClicked={() => selectMode("recording")}
              $={(self) => {
                recordingTab = self
              }}
            >
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                $={withIcon("video", 18, iconSlots)}
              />
            </button>

            <ScreenshotPage
              screenshot={screenshot}
              screenshotTargetGroup={screenshotTargetGroup}
              screenshotDelayGroup={screenshotDelayGroup}
              screenshotFormatGroup={screenshotFormatGroup}
              screenshotOutputGroup={screenshotOutputGroup}
              screenshotCursorGroup={screenshotCursorGroup}
              setScreenshotCursor={setScreenshotCursor}
              onTargetChanged={targetChanged}
              icons={iconSlots}
              setHandle={(handle) => {
                screenshotPage = handle
              }}
            />

            <RecordingPage
              recording={recording}
              recordingTargetGroup={recordingTargetGroup}
              recordingFpsGroup={recordingFpsGroup}
              recordingGifFpsGroup={recordingGifFpsGroup}
              recordingFormatGroup={recordingFormatGroup}
              recordingAudioGroup={recordingAudioGroup}
              recordingQualityGroup={recordingQualityGroup}
              recordingDurationGroup={recordingDurationGroup}
              recordingSizeGroup={recordingSizeGroup}
              recordingCursorGroup={recordingCursorGroup}
              setRecordingCursor={setRecordingCursor}
              onTargetChanged={targetChanged}
              icons={iconSlots}
              syncWindowSize={syncWindowSize}
              setHandle={(handle) => {
                recordingPage = handle
              }}
            />

            <button
              class="bar-cta"
              onClicked={commitCurrentMode}
              $={(self) => {
                cta = self
              }}
            >
              <box
                orientation={Gtk.Orientation.HORIZONTAL}
                spacing={8}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
              >
                <label
                  label="Capture"
                  $={(self) => {
                    ctaLabel = self
                  }}
                />
                <label class="bar-kbd" label="Enter" />
              </box>
            </button>
          </box>

          <SettingsPage
            settingsStore={settingsStore}
            backendProbe={ports.backendProbe}
            selectMode={() => returnHome()}
            mode={barState.mode}
            onSettingsChanged={settingsChanged}
            setHandle={(handle) => {
              settingsPage = handle
            }}
          />
        </box>
      </centerbox>
    </window>
  ) as unknown as Astal.Window
}
