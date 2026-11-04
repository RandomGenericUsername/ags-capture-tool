// ---------------------------------------------------------------------------
// DOMAIN: the S4 live-recording HUD state machine (design.md §3/§5, REQ-004).
//
// The capture bar does not poll the backend. It consumes the hub's
// `capture.state {state, elapsed_seconds, job_id}` feed (design.md §11.7) and
// this module turns those snapshots into the HUD's display state:
//
//   recording -> pulsing dot + a running MM:SS timer
//   paused    -> dot stops pulsing, timer FREEZES at the pushed elapsed value
//   idle      -> the recording is over; the bar leaves S4 for S0
//
// Timestamping belongs to the caller (`nowMs` is injected), so every rule here
// executes under plain Node. Between bus pushes the timer is interpolated
// locally from the last snapshot — a rendered continuous value, never a second
// source of truth. The backend computes `elapsed_seconds` monotonically and
// EXCLUDES paused spans (dotfiles-runtime capture.py `_elapsed`), so a pause
// freeze and a resume continue from the same value.
//
// PURE: no GTK, no GLib, no timers, no I/O.
// ---------------------------------------------------------------------------

import type { CaptureStatePayload } from "../ports/capture-state-feed"
import type { CaptureBarMode } from "./recording-presentation.ts"

export type HudPhase = "idle" | "recording" | "paused"

export interface RecordingHudState {
  phase: HudPhase
  /** Last pushed recorded elapsed time (paused spans already excluded). */
  elapsedSeconds: number
  /** Hub-allocated job id; null before the first `recording` snapshot. */
  jobId: string | null
  /** Wall-clock ms of the snapshot the elapsed value came from. */
  syncedAtMs: number
  /**
   * The last job that reached a terminal state. A replay of that job's
   * `recording`/`paused` snapshots after the stop must not resurrect the HUD.
   */
  endedJobId: string | null
}

/** The closed HUD (no recording known). */
export function idleHud(): RecordingHudState {
  return {
    phase: "idle",
    elapsedSeconds: 0,
    jobId: null,
    syncedAtMs: 0,
    endedJobId: null,
  }
}

/** True while the HUD should be on screen (recording or paused). */
export function isHudLive(state: RecordingHudState): boolean {
  return state.phase === "recording" || state.phase === "paused"
}

// ---------------------------------------------------------------------------
// S4 chrome visibility (design.md D9/§6, REQ-004).
//
// `bar.recording_hud` decides what the live S4 surface looks like. This is a
// pure decision so the three modes can be exercised without GTK:
//
//   hidden  -> nothing automatic. The bar window stays unmapped while live;
//              only a launcher/keybind presentation (`presentedByLauncher`)
//              maps it and reveals the HUD. ags-bar remains the sole automatic
//              live timer, so recordings carry no capture-bar chrome.
//   always  -> the bar is mapped and the Sheet 3 HUD is visible (current S4
//              behaviour); it is therefore part of recorded frames.
//   hover   -> the bar window is UNMAPPED until a compositor pointer poll says
//              the pointer is over the normal S1 bar footprint (SPIKE-001 C).
//              The hidden state is fully click-through; only the revealed
//              76x38 (or 243x46) HUD is mapped and clickable. Entering/leaving
//              never touches the running capture.
//
// Stop stays reachable in every branch: always shows it, hover reveals it on
// pointer entry, hidden reveals it when the launcher presents the bar.
// ---------------------------------------------------------------------------

export interface HudVisibilityInput {
  mode: CaptureBarMode
  /** The capture is live (S4); the bar state owns this, not the bus snapshot. */
  live: boolean
  /** Pointer is inside the bar area (hover mode). */
  pointerInside: boolean
  /** The launcher/keybind presented the bar during this live recording. */
  presentedByLauncher: boolean
  /** Whether a launcher may present an otherwise hidden capture bar. */
  allowLauncherHud: boolean
}

export interface HudVisibility {
  /** Whether the bar window must be mapped. */
  mapWindow: boolean
  /** Whether the S4 chrome (dot/timer/Pause/Stop) is visible. */
  showChrome: boolean
}

export function hudVisibility(input: HudVisibilityInput): HudVisibility {
  if (!input.live) return { mapWindow: false, showChrome: false }
  switch (input.mode) {
    case "always":
      return { mapWindow: true, showChrome: true }
    case "hover":
      // SPIKE-001 C: the hidden window has no input region at all. The poll
      // decides `pointerInside` from the cached S1 footprint; only a revealed
      // HUD is mapped, so clicks over the rest of the bar pass through.
      return { mapWindow: input.pointerInside, showChrome: input.pointerInside }
    case "hidden":
    default:
      // An unknown/corrupt value behaves like the default, never like `always`.
      // The top-bar presentation uses this branch with `allowLauncherHud:false`,
      // so opening the capture UI cannot add a second control surface.
      return {
        mapWindow: input.allowLauncherHud && input.presentedByLauncher,
        showChrome: input.allowLauncherHud && input.presentedByLauncher,
      }
  }
}

/** `MM:SS`, rounded down; minutes are allowed to grow past 99. */
export function formatElapsed(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

/**
 * The elapsed value to render right now.
 *
 * Only a `recording` snapshot advances: paused and idle are frozen at the
 * last pushed value, which is exactly the backend's "paused time does not
 * count" semantics.
 */
export function elapsedAt(state: RecordingHudState, nowMs: number): number {
  if (state.phase !== "recording") return state.elapsedSeconds
  const advance = Math.max(0, Math.floor((nowMs - state.syncedAtMs) / 1000))
  return state.elapsedSeconds + advance
}

/** `MM:SS` for the current instant. */
export function hudTimer(state: RecordingHudState, nowMs: number): string {
  return formatElapsed(elapsedAt(state, nowMs))
}

/** Pause/Stop ownership from `bar_compact_controls` (domain/settings.ts). */
export interface HudControlPlacement {
  /** false + bar_compact_controls: the bar carries Pause/Stop itself. */
  barControls: boolean
  /** true + bar_compact_controls: the popup carries Pause/Stop. */
  popup: boolean
}

export function hudControlPlacement(compact: boolean): HudControlPlacement {
  return { barControls: !compact, popup: compact }
}

/** Pause button copy: it becomes Resume while paused. */
export function pauseLabel(state: RecordingHudState): "Pause" | "Resume" {
  return state.phase === "paused" ? "Resume" : "Pause"
}

/** The hub control action the toggle button should publish. */
export function pauseAction(state: RecordingHudState): "pause" | "resume" {
  return state.phase === "paused" ? "resume" : "pause"
}

function pushElapsed(payload: CaptureStatePayload): number {
  const value = Number(payload.elapsed_seconds)
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function pushJobId(payload: CaptureStatePayload): string | null {
  const value = payload.job_id
  return typeof value === "string" && value !== "" ? value : null
}

/**
 * Apply one `capture.state` snapshot.
 *
 * Idempotent and order-tolerant:
 *   - a duplicate snapshot produces the same phase/elapsed/job values;
 *   - a same-job snapshot whose elapsed went BACKWARDS is stale and ignored,
 *     so a late `recording` cannot undo a newer `paused`;
 *   - a snapshot for a job that already reached `idle` is a replay and ignored;
 *   - any state outside `recording|paused` (including `idle` and an unknown
 *     future value) is terminal: the HUD leaves S4 instead of sticking.
 */
export function reduceCaptureState(
  state: RecordingHudState,
  payload: CaptureStatePayload,
  nowMs: number,
): RecordingHudState {
  const jobId = pushJobId(payload)
  const next = payload.state

  if (next !== "recording" && next !== "paused") {
    if (state.phase === "idle") return state
    return {
      phase: "idle",
      // Keep the last value so a stopped recording's final time is still
      // observable for one render; S0 does not show the HUD anyway.
      elapsedSeconds: state.elapsedSeconds,
      jobId: null,
      syncedAtMs: nowMs,
      endedJobId: jobId ?? state.jobId ?? state.endedJobId,
    }
  }

  if (jobId !== null && state.endedJobId === jobId) return state

  // Same job: elapsed is monotonic by backend construction. A lower value is
  // an out-of-order replay, not a real transition.
  const sameJob = state.jobId !== null && jobId === state.jobId
  if (sameJob && state.phase !== "idle" && pushElapsed(payload) < state.elapsedSeconds) {
    return state
  }

  return {
    phase: next,
    elapsedSeconds: sameJob
      ? Math.max(state.elapsedSeconds, pushElapsed(payload))
      : pushElapsed(payload),
    jobId: jobId ?? state.jobId,
    syncedAtMs: nowMs,
    endedJobId: state.endedJobId,
  }
}

/** Terminal transition for a user-requested stop (before the bus confirms). */
export function stoppedHud(state: RecordingHudState, nowMs: number): RecordingHudState {
  return {
    phase: "idle",
    elapsedSeconds: state.elapsedSeconds,
    jobId: null,
    syncedAtMs: nowMs,
    endedJobId: state.jobId ?? state.endedJobId,
  }
}
