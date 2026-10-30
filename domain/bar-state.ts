// ---------------------------------------------------------------------------
// DOMAIN: the capture bar's S0/S1 surface machine (design.md §3, REQ-002).
//
// S0 is the resting rail (screenshot · recording · settings). S1 is one mode
// open with its option pills and CTA. S2/S3 (pending selection) and S4 (live
// recording) belong to REQ-003/REQ-004; this module deliberately stops at the
// shell so those tickets attach transitions instead of re-deriving the rail.
//
// PURE: no GTK, no GLib, no I/O. The window translates this state into widget
// visibility and keyboard actions.
// ---------------------------------------------------------------------------

export type BarMode = "screenshot" | "recording"
export type BarView = "home" | "settings" | BarMode

export interface BarState {
  view: BarView
  /** The lane the bar will show next; home starts on screenshot. */
  mode: BarMode
}

export const HOME: BarState = { view: "home", mode: "screenshot" }

/** Fresh first-run state (GJS has no structuredClone; the object is tiny). */
export function homeBar(): BarState {
  return { ...HOME }
}

/** Tap a mode icon from anywhere: open that lane without a trip through home. */
export function openMode(_state: BarState, mode: BarMode): BarState {
  return { view: mode, mode }
}

/**
 * Settings is reachable from S0 only (INV-3). A call from an open mode or from
 * settings itself is a no-op rather than a hidden second entry point.
 */
export function openSettings(state: BarState): BarState {
  return state.view === "home" ? { ...state, view: "settings" } : state
}

/** Back one level: S1/settings -> S0. Home stays home. */
export function back(state: BarState): BarState {
  return state.view === "home" ? state : { ...state, view: "home" }
}

export function isModeOpen(state: BarState): boolean {
  return state.view === "screenshot" || state.view === "recording"
}

export function isSettingsOpen(state: BarState): boolean {
  return state.view === "settings"
}

/**
 * What Enter means in this state. `null` means Enter has no capture action
 * (S0), so the key controller must not accidentally commit from the rail.
 */
export function enterAction(state: BarState): BarMode | "settings" | null {
  if (state.view === "settings") return "settings"
  if (state.view === "screenshot" || state.view === "recording") return state.view
  return null
}
