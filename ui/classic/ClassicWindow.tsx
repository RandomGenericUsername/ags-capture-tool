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
  applyHoverLeaveGrace,
  barFootprint,
  createHoverRevealState,
  growHoverRect,
  hoverBarSize,
  unionHoverRects,
  updateHoverReveal,
  type HoverBarMeasurement,
  type HoverRect,
  type HoverRevealState,
  type HoverSize,
} from "../../domain/hover-region"
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
  hudVisibility,
  idleHud,
  isHudLive,
  pauseAction,
  reduceCaptureState,
  stoppedHud,
  type RecordingHudState,
} from "../../domain/recording-hud"
import type { CaptureSettings } from "../../domain/settings"
import { recordingSurfaces } from "../../domain/recording-presentation"
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
import {
  RecordingCluster,
  type RecordingClusterHandle,
} from "../shared/recording-cluster"
import { appearanceRegistry } from "../appearance"
import { RecordingPage, type RecordingPageHandle } from "./RecordingPage"
import { ScreenshotPage, type ScreenshotPageHandle } from "./ScreenshotPage"
import { SettingsPage, type SettingsPageHandle } from "./SettingsPage"

// The name is the window's PUBLIC identity, and it is deliberately NOT unique:
// `style.css` selects the surface with `window#capture-window` and the
// provisioned `capture-ui` launcher toggles it by that name. See
// `tests/ts/window-identity.test.ts` for the full consumer list.
const WINDOW_NAME = "capture-window"

/** 20 Hz: ≤50 ms reveal latency on the measured sub-ms socket query. */
const HOVER_POLL_MS = 50

/**
 * REQ-007: exact bar rectangle, no pointer slack. The helper exists so a future
 * 1–4 px adjustment is a single explicit, tested constant rather than an
 * accidental full-width band.
 */
const HOVER_TOLERANCE_PX = 0

/**
 * BUG-003: brief leave grace so moving from the resting bar to the expanded
 * HUD/popover cannot cross a 1 px gap and unmap the surface mid-gesture.
 */
const HOVER_HIDE_GRACE_MS = 200

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

  // S4 feed. `hud` is the pure snapshot; the shared recording-cluster row is a
  // projection of it. `bar_compact_controls` is locked while live, so it
  // cannot change under the user.
  let hud: RecordingHudState = idleHud()
  // D9 hover/on-demand inputs. `pointerInside` is pure UI state (never a
  // capture control); `hudPresentedByLauncher` remembers that the user asked
  // for the HUD mid-recording in `hidden` mode.
  let pointerInside = false
  let hudPresentedByLauncher = false
  // Stop pressed before the hub has delivered the job id: stop the job as soon
  // as the first snapshot names it instead of leaving it running unobserved.
  let hudStopPending = false
  let hudTicker: number | null = null
  // SPIKE-001 C / REQ-006: while `hover` is live the S4 window is unmapped
  // until the compositor pointer enters the cached S1 footprint. `hoverReveal`
  // is the pure arm-after-leave state; `hoverPoll` is the one shared timer.
  let hoverFootprint: HoverRect | null = null
  let hoverReveal: HoverRevealState = createHoverRevealState()
  let hoverOutsideSince: number | null = null
  let hudPressHeld = false
  let hoverPoll: number | null = null
  // REQ-007: the real resting bar allocation, measured while S0 is on screen.
  // The S1 lane at commit is much wider (1506 vs 142 px on the reference host)
  // and must not become the trigger.
  let restingBar: HoverBarMeasurement | null = null
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
    // REQ-007: remember the real bar while it is still the S0 rail. At commit
    // the rail is hidden (get_width/measure return 0), so the S1 window cannot
    // provide this number. A hidden frame cannot leave a stale rectangle that
    // outlives its monitor: the measurement carries the connector and
    // `hoverBarSize()` invalidates a cross-monitor cache.
    if (rail?.visible && barState.view === "home") {
      const [, railWidth] = rail.measure(Gtk.Orientation.HORIZONTAL, -1)
      const [, railHeight] = rail.measure(Gtk.Orientation.VERTICAL, railWidth)
      if (railWidth > 0 && railHeight > 0) {
        restingBar = {
          connector: gdkmonitor.get_connector(),
          width: railWidth,
          height: railHeight,
        }
      }
    }
  }

  /**
   * Snapshot the hover trigger from the CONFIGURED BAR, not the S1 window
   * (REQ-007).
   *
   * Called from `hideBar` while the lane is still S1 and before
   * `applyBarState()` shrinks it. The S1 row is 1506×54 here because it carries
   * every option pill; the resting bar is only 142×54. `restingBar` is measured
   * while S0 is on screen (`syncWindowSize`), then combined at commit with the
   * CURRENT monitor geometry, placement and margins, so top/bottom, offset and
   * a resized bar all follow. If no valid measurement exists, `hoverBarSize`
   * returns the window allocation: the v0.2.2 fallback, never "no reveal".
   */
  function captureHoverFootprint(): HoverRect | null
  function captureHoverFootprint(sizeOverride: HoverSize): HoverRect | null
  function captureHoverFootprint(sizeOverride: HoverSize | null = null): HoverRect | null {
    const window = captureWindow
    if (window === null) return null
    const geometry = gdkmonitor.get_geometry()
    const size =
      sizeOverride ??
      hoverBarSize(
        restingBar,
        gdkmonitor.get_connector(),
        { width: window.get_width(), height: window.get_height() },
      )
    if (size === null) return null
    const footprint = barFootprint(
      {
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
      },
      size,
      {
        position: config.bar.position,
        marginTop: window.margin_top,
        marginBottom: window.margin_bottom,
      },
    )
    return growHoverRect(footprint, HOVER_TOLERANCE_PX)
  }

  /**
   * BUG-003: the rectangle of the surface that is actually mapped right now.
   *
   * While hidden this is the HUD row's future allocation, but `hoverFootprint`
   * keeps the resting bar in the union. Once revealed, the HUD row can be
   * wider (full Pause/Stop lane) than the 142 px resting bar, and the trigger
   * must follow it. A collapse simply makes this measurement smaller again;
   * the next poll recomputes the union, so no stale lane survives.
   */
  function visibleBarHoverRect(): HoverRect | null {
    const window = captureWindow
    if (window === null) return null
    return captureHoverFootprint({
      width: window.get_width(),
      height: window.get_height(),
    })
  }

  /**
   * BUG-003: the on-demand Pause/Stop popover (`bar_compact_controls = true`).
   *
   * A Gtk.Popover is its own Gdk popup surface, so the bar window's rectangle
   * does not contain it. Its position is relative to the parent surface, which
   * is the already-fitted bar rect. If the compositor/GTK cannot report that
   * geometry, `null` makes the poll fall back to "keep mapped while the popover
   * is open", never to an invented rectangle.
   */
  function popupHoverRect(): HoverRect | null {
    const popup = hudPopup
    const window = captureWindow
    if (popup === null || window === null || !popup.get_visible()) return null
    const surface = popup.get_native()?.get_surface() ?? null
    if (surface === null) return null
    const popupSurface = surface as Gdk.Popup
    if (
      typeof popupSurface.get_position_x !== "function" ||
      typeof popupSurface.get_position_y !== "function"
    ) {
      return null
    }
    const anchor = visibleBarHoverRect()
    if (anchor === null) return null
    const width = surface.get_width()
    const height = surface.get_height()
    if (width <= 0 || height <= 0) return null
    return growHoverRect(
      {
        x: anchor.x + popupSurface.get_position_x(),
        y: anchor.y + popupSurface.get_position_y(),
        width,
        height,
      },
      HOVER_TOLERANCE_PX,
    )
  }

  /** Stop the poll but keep the cached footprint (e.g. a mode switch). */
  function stopHoverPoll() {
    if (hoverPoll !== null) {
      GLib.source_remove(hoverPoll)
      hoverPoll = null
    }
  }

  /** Forget the trigger entirely: recording ended, window is going away. */
  function clearHoverReveal() {
    stopHoverPoll()
    hoverFootprint = null
    hoverReveal = createHoverRevealState()
    hoverOutsideSince = null
    hudPressHeld = false
    pointerInside = false
  }

  /**
   * Poll the compositor pointer while `hover` is live.
   *
   * A null read (no Hyprland/socket) leaves the HUD hidden; it never throws.
   * The first sample cannot reveal when the pointer is already inside (the
   * Record-CTA case): `updateHoverReveal` stays unarmed until an outside
   * sample, so the opening frames stay clean.
   *
   * BUG-003: every tick recomputes the trigger as the union of the resting
   * footprint, the CURRENT mapped bar/HUD rect and an open Pause/Stop popover.
   * The resting 142x54 rect alone made the poll unmap the HUD as soon as the
   * pointer moved onto the wider controls. A short leave grace plus a press
   * hold keep that expanded surface mapped while it is being clicked.
   */
  function syncHoverPoll() {
    stopHoverPoll()
    hoverReveal = createHoverRevealState()
    hoverOutsideSince = null
    hudPressHeld = false
    pointerInside = false
    if (
      !isLive(barState) ||
      surfaces().captureBar !== "hover" ||
      hoverFootprint === null
    ) {
      return
    }
    hoverPoll = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_POLL_MS, () => {
      if (!isLive(barState) || surfaces().captureBar !== "hover") {
        stopHoverPoll()
        pointerInside = false
        if (isLive(barState)) applyHudVisibility()
        return false
      }
      const popupOpen = hudPopup?.get_visible() === true
      const popupRect = popupHoverRect()
      // Only a MAPPED (or currently revealing) bar may contribute its larger
      // HUD rect. While hidden the window may already carry the HUD's future
      // allocation; including it would widen the initial trigger back beyond
      // REQ-007's resting bar.
      const surfaceActive =
        captureWindow?.visible === true || pointerInside
      const region = unionHoverRects(
        hoverFootprint,
        surfaceActive ? visibleBarHoverRect() : null,
        popupRect,
      )
      const next = updateHoverReveal(
        hoverReveal,
        ports.pointerPosition.current(),
        region,
      )
      const grace = applyHoverLeaveGrace(
        hoverReveal,
        next,
        hoverOutsideSince,
        Date.now(),
        HOVER_HIDE_GRACE_MS,
        hudPressHeld || (popupOpen && popupRect === null),
      )
      const revealed = grace.state.revealed
      hoverReveal = grace.state
      hoverOutsideSince = grace.outsideSinceMs
      if (revealed !== pointerInside) {
        pointerInside = revealed
        applyHudVisibility()
      }
      return true
    })
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
  let hudPopup: Gtk.Popover | null = null
  let hudCluster: RecordingClusterHandle | null = null
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
  function surfaces() {
    return recordingSurfaces(config.recording_controls)
  }

  function applyHudPlacement() {
    const placement = hudControlPlacement(config.bar_compact_controls)
    if (!placement.popup) hudCluster?.closePopover()
  }

  /**
   * Project `bar.recording_hud` (D9/§6) onto the S4 window and row.
   *
   * The pure rule decides; this only applies it. `opacity` hides the chrome
   * without collapsing the row, while `visible` maps only a revealed HUD in
   * `hover` mode (SPIKE-001 C): the hidden surface has no input region, so the
   * bar area stays click-through. Mapping is only touched while live: S0/S1
   * visibility stays the focus/window-set contract.
   */
  function applyHudVisibility() {
    const live = isLive(barState)
    const current = surfaces()
    const visibility = hudVisibility({
      mode: current.captureBar,
      live,
      pointerInside,
      presentedByLauncher: hudPresentedByLauncher,
      allowLauncherHud: current.allowLauncherHud,
    })
    if (hudRow) hudRow.opacity = visibility.showChrome ? 1 : 0
    // A popover is a separate surface and would otherwise outlive hidden
    // chrome (hover pointer-leave, or `hidden` before presentation).
    if (!visibility.showChrome) hudPopup?.popdown()
    if (!live || captureWindow === null) return
    if (visibility.mapWindow) {
      if (!captureWindow.visible) {
        captureWindow.visible = true
        captureWindow.present()
      }
    } else if (captureWindow.visible) {
      // `hover` hidden or `hidden` with no on-demand presentation: nothing may
      // reach a frame and no input region may remain.
      hideCaptureWindow()
    }
  }

  /** Project the pure HUD snapshot onto the shared cluster row. */
  function updateHudUi() {
    hudCluster?.render({ hud, compact: config.bar_compact_controls })
    if (isLive(barState)) applyHudPlacement()
  }

  /**
   * S4 entry. Recording commits hide the pending UI first (FR-10), then this
   * hands the decision to `bar.recording_hud` (D9): `always` maps the HUD,
   * `hover` stays UNMAPPED until the compositor poll sees the pointer over the
   * cached S1 footprint, `hidden` stays unmapped unless the user presents it.
   * The first `capture.state` snapshot fills in the job id and timer.
   * Screenshot never calls it, so its commit still hides the bar.
   */
  function enterLiveHud() {
    hud = idleHud()
    hudStopPending = false
    hudPresentedByLauncher = false
    // Re-read who owns Pause/Stop and which HUD mode is active at the moment
    // the lane goes live; options are locked from here, so one read is the
    // whole S4 lifetime.
    config = settingsStore.load()
    barState = enterLive(barState)
    // `applyBarState` ends in `applyHudVisibility`: always maps/presents, hover
    // stays hidden (no input region), hidden stays unmapped. The poll starts
    // only after that first clean frame.
    applyBarState()
    syncHoverPoll()
  }

  /** Back to S0 without destroying anything: Stop's documented exit. */
  function leaveLiveHud() {
    // No poll may outlive S4; the surface also drops any revealed HUD state.
    clearHoverReveal()
    hudPopup?.popdown()
    // `hover` owns no surface when recording ends: the revealed HUD unmaps
    // (REQ-006 lifecycle). `hidden` had no automatic surface either, but a
    // launcher-presented HUD goes away on stop. `always` returns to S0.
    const current = surfaces()
    const hoverMode = current.captureBar === "hover"
    const hideAfterStop =
      current.captureBar === "hidden" && hudPresentedByLauncher
    barState = homeBar()
    hudPresentedByLauncher = false
    applyBarState()
    if (hideAfterStop || hoverMode) hideCaptureWindow()
    else if (captureWindow?.visible) captureWindow.present()
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
        // A recording started outside this window's commit has no cached S1
        // footprint; `syncHoverPoll` is a no-op in that case and never invents
        // a trigger region.
        syncHoverPoll()
      } else {
        updateHudUi()
        applyHudVisibility()
      }
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
   * BUG-003: keep the revealed surface mapped for the whole press/release of a
   * HUD control. Without this, a slow click (or a press that drifts past the
   * short leave grace) could unmap the window before its `clicked` fires.
   * The gesture only observes; it never claims the event, so the buttons keep
   * their normal activation.
   */
  function watchHudPress(widget: Gtk.Widget) {
    const press = new Gtk.GestureClick()
    press.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    press.connect("pressed", () => {
      hudPressHeld = true
    })
    press.connect("released", () => {
      hudPressHeld = false
    })
    press.connect("stopped", () => {
      hudPressHeld = false
    })
    widget.add_controller(press)
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
    applyHudVisibility()
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
   * Recording then consults `bar.recording_hud` (D9) after the hides and before
   * the launcher spawns: `always`/`hover` may map the bar as the S4 HUD, while
   * `hidden` leaves it unmapped so no capture-bar chrome can reach a frame.
   * The pending row is gone either way. Screenshot keeps REQ-003's
   * hide-and-stay-hidden behaviour.
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
        // The bar is still S1 here: this is the one moment its real allocation
        // is the full recording lane. Cache it before `applyBarState` shrinks
        // the window to S0 (REQ-006).
        if (committingRecording) hoverFootprint = captureHoverFootprint()
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
    // `recording_hud` is an S4 decision. If it changed under a live lane, stop
    // or start the hover poll and re-apply the pure rule without touching the
    // capture (options stay locked; this is the external-config path).
    if (isLive(barState)) {
      if (surfaces().captureBar === "hover") syncHoverPoll()
      else {
        stopHoverPoll()
        pointerInside = false
      }
      applyHudVisibility()
    }
  }

  // The S4 row is the SAME shared cluster the top bar shows. The capture
  // window only supplies the row/window visibility; it must not grow a second
  // dot/timer/button/popover design.
  hudCluster = RecordingCluster({
    onToggle: togglePause,
    onStop: stopRecording,
    onPopoverClose: () => {
      if (isLive(barState)) applyHudVisibility()
    },
  })
  hudRow = hudCluster.root
  hudPopup = hudCluster.popover
  watchHudPress(hudCluster.root)
  watchHudPress(hudCluster.popover)

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
          if (isLive(barState) && hud.phase === "recording") updateHudUi()
          return true
        })
        self.connect("destroy", () => {
          // No poll, cached footprint or armed state survives the window.
          hudCluster?.destroy()
          hudCluster = null
          clearHoverReveal()
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
        // Hover mode (D9/REQ-006): the poll owns the reveal; the motion
        // controller must not hide the HUD as soon as the pointer moves off the
        // small 76x38 surface but is still inside the S1 footprint. In other
        // modes it stays the harmless hit-area tracker it always was.
        const motion = new Gtk.EventControllerMotion()
        motion.connect("enter", () => {
          if (hoverPoll !== null) return
          pointerInside = true
          if (isLive(barState)) applyHudVisibility()
        })
        motion.connect("motion", () => {
          if (hoverPoll !== null) return
          if (!pointerInside) {
            pointerInside = true
            if (isLive(barState)) applyHudVisibility()
          }
        })
        motion.connect("leave", () => {
          if (hoverPoll !== null) return
          pointerInside = false
          if (isLive(barState)) applyHudVisibility()
        })
        self.add_controller(motion)
        // Toggling an on-demand `hidden` HUD away is a user decision too: clear
        // the presentation flag so the next `capture.state` push cannot bring
        // the surface back automatically.
        self.connect("unmap", () => {
          // A press guard cannot survive the surface it was protecting.
          hudPressHeld = false
          if (isLive(barState) && !surfaces().allowLauncherHud) {
            hudPresentedByLauncher = false
          }
        })
        self.connect("map", () => {
          applyStateToUi()
          applyPlacement()
          // `hidden` maps nothing automatically. A launcher/keybind toggle is
          // the ONE on-demand presentation path: mapping while live means the
          // user asked for the HUD, so reveal it (Stop/Pause) without touching
          // the capture. `always`/`hover` are already reachable by definition.
          const current = surfaces()
          if (
            isLive(barState) &&
            current.allowLauncherHud &&
            current.captureBar === "hidden"
          ) {
            hudPresentedByLauncher = true
          }
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

          {hudCluster?.element ?? null}

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
