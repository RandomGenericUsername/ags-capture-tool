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
import GLib from "gi://GLib?version=2.0"
import { barMarginTop } from "../../domain/bar-placement"
import {
  back,
  enterAction,
  enterLive,
  homeBar,
  isLive,
  isModeOpen,
  isSettingsOpen,
  openMode,
  openSettings,
  type BarState,
  type BarMode,
} from "../../domain/bar-state"
import { recordingArgs, screenshotArgs } from "../../domain/cli-args"
import type { RecordingRequest, ScreenshotRequest } from "../../domain/capture-request"
import {
  hudControlPlacement,
  hudTimer,
  idleHud,
  isHudLive,
  pauseAction,
  pauseLabel,
  reduceCaptureState,
  stoppedHud,
  type RecordingHudState,
} from "../../domain/recording-hud"
import type { CaptureSettings } from "../../domain/settings"
import { runCommit } from "../../lib/commit-order"
import type { CaptureStatePayload } from "../../ports/capture-state-feed"
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
  const { settingsStore, uiStateStore, launcher, captureState, monitorReservedTop } = ports

  const initialSettings = settingsStore.load()
  const initialTop = initialSettings.bar.position === "top"
  const initialMargin = initialTop
    ? barMarginTop(
        initialSettings.bar.position,
        monitorReservedTop.reservedTop(gdkmonitor.get_connector()),
        initialSettings.bar.offsetPx,
      )
    : 0

  // The S0/S1 surface machine. S2/S3 are the selection controller's; S4 is the
  // live HUD whose *display* state lives in `domain/recording-hud.ts`.
  let barState: BarState = homeBar()
  let config: CaptureSettings = initialSettings

  // S4 feed. `hud` is the pure snapshot; the widgets below are a projection of
  // it. `hudCompact` mirrors `bar_compact_controls` at the moment the lane went
  // live (options are locked while live, so it cannot change under the user).
  let hud: RecordingHudState = idleHud()
  let hudCompact = false
  // Stop pressed before the hub has delivered the job id: stop the job as soon
  // as the first snapshot names it instead of leaving it running unobserved.
  let hudStopPending = false
  let hudTicker: number | null = null
  let unsubscribeFeed: (() => void) | null = null
  let unsubscribeRestart: (() => void) | null = null

  // THIS window, captured from its own `<window>` `$` handler rather than
  // looked up by name (fix-capture-window-identity).
  let captureWindow: Astal.Window | null = null
  const iconSlots = createIconSlots()
  let unregisterAppearance: (() => void) | null = null
  let unsubscribeSelection: (() => void) | null = null

  function hideCaptureWindow() {
    if (captureWindow) captureWindow.visible = false
  }

  /**
   * A newly mapped TOP overlay can take the pointer/focus surface; re-present
   * the bar after the state change so its ON_DEMAND keyboard controller stays
   * reachable (design.md §11.8 risk). Only while the bar is already visible.
   */
  function presentBar() {
    if (captureWindow?.visible) captureWindow.present()
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
  let shell: Gtk.Box | null = null
  let rail: Gtk.Box | null = null
  let openRow: Gtk.Box | null = null
  let screenshotTab: Gtk.Button | null = null
  let recordingTab: Gtk.Button | null = null
  let cta: Gtk.Button | null = null
  let ctaLabel: Gtk.Label | null = null
  let hudRow: Gtk.Box | null = null
  let hudDot: Gtk.Box | null = null
  let hudTimerLabel: Gtk.Label | null = null
  let hudActions: Gtk.Box | null = null
  let hudToggle: Gtk.Button | null = null
  let hudToggleLabel: Gtk.Label | null = null
  let hudPopup: Gtk.Popover | null = null
  let hudPopupToggle: Gtk.Button | null = null
  let hudPopupToggleLabel: Gtk.Label | null = null
  let monitorChip: Gtk.Button | null = null
  let monitorChipLabel: Gtk.Label | null = null
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
    if (monitorChip && monitorChipLabel) {
      const screen = modeOpen && currentTarget() === "screen"
      const count = selection.monitors().length
      monitorChip.visible = screen && count > 1
      if (screen && count > 1) {
        const pending = selection.pending()
        const picked = pending.target === "screen" ? (pending.monitor ?? selection.focused()) : selection.focused()
        monitorChipLabel.set_label(`Monitor ${selection.monitorIndex(picked) || 1}`)
      }
    }
  }

  /**
   * `bar_compact_controls` decides who carries Pause/Stop (design.md §6):
   * true = dot+timer only in the bar, the popup carries the controls; false =
   * the bar carries them. Both are the SAME state; only the widgets move.
   */
  function applyHudPlacement() {
    const placement = hudControlPlacement(config.bar_compact_controls)
    hudCompact = placement.popup
    if (hudActions) hudActions.visible = placement.barControls
    if (!placement.popup) hudPopup?.popdown()
  }

  /** Project the pure HUD snapshot onto the built widgets (no state change). */
  function updateHudUi() {
    if (hudTimerLabel) hudTimerLabel.set_label(hudTimer(hud, Date.now()))
    if (hudDot) {
      if (hud.phase === "paused") hudDot.add_css_class("paused")
      else hudDot.remove_css_class("paused")
    }
    const label = pauseLabel(hud)
    if (hudToggleLabel) hudToggleLabel.set_label(label)
    if (hudPopupToggleLabel) hudPopupToggleLabel.set_label(label)
    // Pause needs a job id to route `Control`; before the first snapshot there
    // is nothing to control. Stop remains available as the one exit.
    if (hudToggle) hudToggle.sensitive = hud.jobId !== null
    if (hudPopupToggle) hudPopupToggle.sensitive = hud.jobId !== null
    if (isLive(barState)) applyHudPlacement()
  }

  /**
   * S4 entry. Recording commits hide the pending UI first (FR-10), then this
   * brings the bar back as the HUD BEFORE the launcher spawns; the first
   * `capture.state` snapshot fills in the job id and timer. Screenshot never
   * calls it, so its commit still hides the bar.
   */
  function enterLiveHud() {
    hud = idleHud()
    hudStopPending = false
    // Re-read who owns Pause/Stop at the moment the lane goes live; options
    // are locked from here, so one read is the whole S4 lifetime.
    config = settingsStore.load()
    barState = enterLive(barState)
    applyBarState()
    if (captureWindow) {
      captureWindow.visible = true
      captureWindow.present()
    }
  }

  /** Back to S0 without destroying anything: Stop's documented exit. */
  function leaveLiveHud() {
    hudPopup?.popdown()
    barState = homeBar()
    applyBarState()
    if (captureWindow?.visible) captureWindow.present()
  }

  /**
   * One `capture.state` snapshot. The pure reducer owns ordering/idempotency;
   * this only decides whether the HUD maps and when it closes. A terminal
   * snapshot (idle, cancel, failure, unknown) returns the bar to S0 instead of
   * leaving a stuck indicator.
   */
  function onCaptureState(payload: CaptureStatePayload) {
    const next = reduceCaptureState(hud, payload, Date.now())
    if (next === hud) return
    hud = next
    if (isHudLive(next)) {
      // A Stop raced the first snapshot: control the job the moment it is
      // named, then close the HUD without ever showing a live timer.
      if (hudStopPending) {
        if (next.jobId !== null) captureState.control(next.jobId, "stop")
        hudStopPending = false
        hud = stoppedHud(next, Date.now())
        leaveLiveHud()
        return
      }
      if (!isLive(barState)) {
        barState = enterLive(barState)
        applyBarState()
      }
      updateHudUi()
      if (captureWindow?.visible) captureWindow.present()
      return
    }
    hudStopPending = false
    if (isLive(barState)) leaveLiveHud()
  }

  function togglePause() {
    if (hud.jobId === null) return
    captureState.control(hud.jobId, pauseAction(hud))
  }

  /**
   * Stop is the ONLY exit from S4. The hub control is the single control path;
   * the local phase closes immediately so the HUD cannot stick if the hub
   * never answers, and `endedJobId` makes a late replay of this job a no-op.
   */
  function stopRecording() {
    if (hud.jobId !== null) captureState.control(hud.jobId, "stop")
    else hudStopPending = true
    hud = stoppedHud(hud, Date.now())
    leaveLiveHud()
  }

  /** Translate the pure bar state into the built widget tree. */
  function applyBarState() {
    const modeOpen = isModeOpen(barState)
    const live = isLive(barState)
    // The recording lane owns the red accent (design.md D4/§11.6). One class
    // on the shell scopes the chip, selected pills and CTA together, so the
    // screenshot lane cannot pick up a recording colour by accident.
    if (shell) {
      if (barState.view === "recording" || live) shell.add_css_class("recording")
      else shell.remove_css_class("recording")
    }
    if (rail) rail.visible = barState.view === "home"
    if (openRow) openRow.visible = modeOpen
    if (hudRow) hudRow.visible = live
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
    updateHudUi()
    syncWindowSize()
  }

  function selectMode(next: BarMode) {
    const wasOpen = barState.view === next
    barState = openMode(barState, next)
    // Entering a lane engages its pending selection immediately (S1 -> S2).
    // Re-tapping the active lane keeps the current pending object.
    if (!wasOpen) selection.begin(next, currentTarget())
    applyBarState()
    presentBar()
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
    presentBar()
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
   * state.
   *
   * Recording then returns the bar as the S4 HUD (design.md §3): the pending
   * row is gone before the backend can see a frame, but the bar the user keeps
   * is the live indicator. Screenshot keeps REQ-003's hide-and-stay-hidden
   * behaviour.
   *
   * The legacy interactive backend path (no geometry/reference flags) is still
   * available to CLI users, but this UI never calls it: every request carries
   * the finished `Selection`.
   */
  function commitCurrentMode() {
    const finished = selection.selection()
    if (finished === null) return
    if (finished.kind !== currentTarget()) return
    const committingRecording = barState.view === "recording"
    uiStateStore.save(screenshot, recording)
    const current = settingsStore.load()
    const argv = committingRecording
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
        // Lock the session and hide synchronously; `hideNow()` is idempotent
        // and covers a selector that vanished between the check and launch.
        selection.commit()
        selection.hideNow()
      },
      hideBar: () => {
        barState = homeBar()
        applyBarState()
        hideCaptureWindow()
      },
      // Only recording re-maps the bar: the S4 HUD must be on screen before
      // the backend's first frame, and this runs after the hides so no
      // pending option can leak into that frame.
      showHud: committingRecording ? enterLiveHud : undefined,
      launch: () => launcher.launch(argv),
    })
  }

  function onKey(keyval: number): boolean {
    // S4 has no keyboard exit: INV-2 suppresses the back chevron, Enter must
    // not start a second recording, and Stop is the only exit (mockup Sheet 3).
    if (isLive(barState)) return true
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
        // The screen pick can also change from another monitor's overlay, so
        // the bar's chip/CTA mirror the controller rather than only its own
        // click handlers.
        unsubscribeSelection = selection.subscribe(() => syncSelectionUi())
        // S4 is a consumer of the hub's domain event, never backend stdout
        // (design.md §11.7). Subscribe-before-read is inside the platform
        // client, so a bar that starts mid-recording renders immediately.
        unsubscribeFeed = captureState.subscribe(onCaptureState)
        // A hub restart invalidates the old job: never leave a stale HUD up.
        unsubscribeRestart = captureState.onRestart(() => {
          hud = idleHud()
          hudStopPending = false
          if (isLive(barState)) leaveLiveHud()
        })
        // Continuous rendering between pushes: the backend's pushed timer is
        // the source of truth, and paused/idle values are frozen.
        hudTicker = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
          if (isLive(barState) && hud.phase === "recording" && hudTimerLabel !== null) {
            hudTimerLabel.set_label(hudTimer(hud, Date.now()))
          }
          return true
        })
        self.connect("destroy", () => {
          if (unsubscribeSelection !== null) {
            unsubscribeSelection()
            unsubscribeSelection = null
          }
          if (unsubscribeFeed !== null) {
            unsubscribeFeed()
            unsubscribeFeed = null
          }
          if (unsubscribeRestart !== null) {
            unsubscribeRestart()
            unsubscribeRestart = null
          }
          if (hudTicker !== null) {
            GLib.source_remove(hudTicker)
            hudTicker = null
          }
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
          // Focus changes re-map which monitor's bar is visible (D2). The
          // selection controller is app-wide, so keep THIS window's surface
          // state and the shared pending session from disagreeing: an S0 bar
          // must never appear over an active overlay, and an open lane must
          // re-engage if its session was closed by another window's S0.
          if (isModeOpen(barState)) {
            if (!selection.session().active) {
              selection.begin(barState.view === "recording" ? "recording" : "screenshot", currentTarget())
            }
          } else if (selection.session().active) {
            selection.end()
          }
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
          $={(self) => {
            shell = self
          }}
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
              visible={false}
              class="bar-pill monitor-chip"
              tooltipText="Switch the pending screen pick"
              onClicked={() => {
                selection.cycleMonitor()
                applyBarState()
              }}
              $={(self) => {
                monitorChip = self
              }}
            >
              <label
                label="Monitor 1"
                $={(self) => {
                  monitorChipLabel = self
                }}
              />
            </button>

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

          {/* --------------------------------------------------- S4 HUD
              Recording-live is HUD only (INV-2/INV-5): pulse dot, elapsed
              timer, Pause/Stop. No back chevron, no target/fps/quality/audio
              pills, no settings entry. `bar_compact_controls` decides whether
              the controls live in this row or in the popup. */}
          <box
            visible={false}
            class="capture-bar hud"
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={8}
            $={(self) => {
              hudRow = self
            }}
          >
            <button
              class="hud-status"
              tooltipText="Recording controls"
              onClicked={() => {
                if (hudCompact) hudPopup?.popup()
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
                    hudDot = self
                  }}
                />
                <label
                  class="hud-timer"
                  label="00:00"
                  $={(self) => {
                    hudTimerLabel = self
                  }}
                />
              </box>
            </button>
            <box
              class="hud-actions"
              orientation={Gtk.Orientation.HORIZONTAL}
              spacing={6}
              $={(self) => {
                hudActions = self
              }}
            >
              <button
                class="bar-pill hud-toggle"
                tooltipText="Pause or resume the recording"
                onClicked={togglePause}
                $={(self) => {
                  hudToggle = self
                }}
              >
                <label
                  label="Pause"
                  $={(self) => {
                    hudToggleLabel = self
                  }}
                />
              </button>
              <button
                class="bar-pill hud-stop"
                tooltipText="Stop recording"
                onClicked={stopRecording}
              >
                <label label="⏹ Stop" />
              </button>
            </box>
            <popover
              $={(self) => {
                hudPopup = self
              }}
            >
              <box
                class="hud-popup"
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
              >
                <box
                  class="hud-popup-row"
                  orientation={Gtk.Orientation.HORIZONTAL}
                  spacing={8}
                >
                  <box class="hud-dot" valign={Gtk.Align.CENTER} />
                  <label label="Recording" />
                </box>
                <box homogeneous spacing={8}>
                  <button
                    class="bar-pill hud-toggle"
                    onClicked={togglePause}
                    $={(self) => {
                      hudPopupToggle = self
                    }}
                  >
                    <label
                      label="Pause"
                      $={(self) => {
                        hudPopupToggleLabel = self
                      }}
                    />
                  </button>
                  <button class="bar-pill hud-stop" onClicked={stopRecording}>
                    <label label="⏹ Stop" />
                  </button>
                </box>
              </box>
            </popover>
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
