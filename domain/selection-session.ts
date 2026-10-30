// ---------------------------------------------------------------------------
// DOMAIN: the pending-selection session — a tiny pure state machine behind the
// overlays (REQ-003, design.md §3/§4/§4.7).
//
// The bar's `BarState` says which surface is open; this says what is selected
// inside it. Keeping the two separate is what makes "commit is a one-way door"
// (D6) provable: `commitSelection()` returns an INACTIVE session, and every
// mutator below refuses to act on an inactive session. There is deliberately no
// transition from inactive back to an editable pick — opening a mode creates a
// NEW session via `beginSelection()`.
//
// PURE: no GTK, no GLib, no I/O.
// ---------------------------------------------------------------------------

import type { CaptureTarget } from "../types"
import type { PendingPick, Rect, Selection } from "./selection"

/** One open mode's editable selection. */
export interface SelectionSession {
  /** False before a mode opens, and irreversibly after a commit. */
  active: boolean
  target: CaptureTarget
  pending: PendingPick
}

/** The first-run/closed state. No selection exists until a mode opens. */
export function emptySelection(target: CaptureTarget = "region"): SelectionSession {
  return { active: false, target, pending: initialPick(target) }
}

/** Opening a mode engages that target's pending selection immediately (FR-4). */
export function beginSelection(target: CaptureTarget): SelectionSession {
  return { active: true, target, pending: initialPick(target) }
}

/**
 * Target pills swap the pending object. While a session is INACTIVE this is a
 * strict no-op, which is the machine-level expression of D6.
 */
export function retargetSelection(
  session: SelectionSession,
  target: CaptureTarget,
): SelectionSession {
  if (!session.active || session.target === target) return session
  return { ...session, target, pending: initialPick(target) }
}

function initialPick(target: CaptureTarget): PendingPick {
  switch (target) {
    case "region":
      return { target: "region", rect: null }
    case "window":
      return { target: "window", address: null }
    case "screen":
      // null means "the focused monitor", so the default follows focus instead
      // of freezing the monitor that happened to be focused when the mode
      // opened. A non-null value is an explicit swap.
      return { target: "screen", monitor: null }
  }
}

export function setRegionRect(
  session: SelectionSession,
  rect: Rect | null,
): SelectionSession {
  if (!session.active || session.target !== "region" || session.pending.target !== "region") {
    return session
  }
  return { ...session, pending: { target: "region", rect } }
}

export function setPinnedWindow(
  session: SelectionSession,
  address: string | null,
): SelectionSession {
  if (!session.active || session.target !== "window" || session.pending.target !== "window") {
    return session
  }
  return { ...session, pending: { target: "window", address } }
}

/** An explicit monitor pick; the focused monitor is represented as null. */
export function setScreenMonitor(
  session: SelectionSession,
  monitor: string | null,
  focused: string | null,
): SelectionSession {
  if (!session.active || session.target !== "screen" || session.pending.target !== "screen") {
    return session
  }
  const explicit = monitor === null || monitor === focused ? null : monitor
  return { ...session, pending: { target: "screen", monitor: explicit } }
}

/**
 * The finished selection, or null when the pick is not committable yet.
 *
 * Screen is special: the focused monitor is always a valid pending pick, so
 * `Shutter` works without an extra click. Region and window need the user's
 * gesture first.
 */
export function selectionOf(
  session: SelectionSession,
  focusedMonitor: string | null,
): Selection | null {
  if (!session.active) return null
  const pending = session.pending
  switch (pending.target) {
    case "region":
      return pending.rect === null
        ? null
        : { kind: "region", geometry: pending.rect }
    case "window":
      return pending.address === null
        ? null
        : { kind: "window", address: pending.address }
    case "screen": {
      const monitor = pending.monitor ?? focusedMonitor
      return monitor === null ? null : { kind: "screen", monitor }
    }
  }
}

export function canCommit(
  session: SelectionSession,
  focusedMonitor: string | null,
): boolean {
  return selectionOf(session, focusedMonitor) !== null
}

/**
 * Rung (a) of the Esc ladder (design.md §4.7): clear the pending pick, keep the
 * mode open. `closed: true` means there was nothing left to clear, so the bar
 * should perform rung (b) and close the mode.
 *
 * - region: a drawn rect is cleared to an empty canvas;
 * - window: a pinned client is unpinned;
 * - screen: an explicitly swapped monitor returns to the focused default.
 *
 * A screen chip already showing the focused monitor has nothing to clear; the
 * same is true for an empty region canvas or an unpinned window.
 */
export function clearPending(
  session: SelectionSession,
  focusedMonitor: string | null,
): { session: SelectionSession; closed: boolean } {
  if (!session.active) return { session, closed: true }
  const pending = session.pending
  switch (pending.target) {
    case "region":
      return pending.rect === null
        ? { session, closed: true }
        : { session: { ...session, pending: { target: "region", rect: null } }, closed: false }
    case "window":
      return pending.address === null
        ? { session, closed: true }
        : { session: { ...session, pending: { target: "window", address: null } }, closed: false }
    case "screen":
      return pending.monitor === null || pending.monitor === focusedMonitor
        ? { session, closed: true }
        : { session: { ...session, pending: { target: "screen", monitor: null } }, closed: false }
  }
}

/**
 * Commit: snapshot the finished selection and lock the session inactive.
 *
 * The returned session has no editable state left, and it is the only value the
 * controller keeps after a commit, so a later event cannot alter the geometry
 * that was captured (D6). A non-committable session commits nothing.
 */
export function commitSelection(
  session: SelectionSession,
  focusedMonitor: string | null,
): { session: SelectionSession; selection: Selection | null } {
  const selection = selectionOf(session, focusedMonitor)
  if (selection === null) return { session, selection: null }
  return { session: emptySelection(session.target), selection }
}
