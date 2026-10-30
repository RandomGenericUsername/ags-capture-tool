// ---------------------------------------------------------------------------
// FR-10: the overlay is never part of a shipped capture.
//
// The ordering is the requirement, not an implementation detail: the dim +
// selection chrome must be OFF SCREEN synchronously with the shutter, BEFORE
// the backend is allowed to read the display. For recording this is a hard
// first-frame guarantee (design.md §4 rule 3 / D7).
//
// Why this is a separate pure function instead of three lines in the view:
// "hide then launch" is trivially easy to write in the wrong order during a
// later refactor, and the failure is silent (a dim rectangle baked into the
// first recorded frame). `tests/ts/commit-order.test.ts` executes this exact
// function and pins the call order, so the invariant has a red test rather
// than a comment.
//
// The launcher adapter keeps its own 150ms compositor delay
// (`adapters/exec-capture-launcher.ts`); that delay runs AFTER this sequence,
// so it cannot reorder the hide against the spawn.
//
// PURE: callbacks in, no GTK, no process, no I/O.
// ---------------------------------------------------------------------------

export interface CommitSequence {
  /** Hide/destroy the overlay chrome synchronously. */
  hideOverlay: () => void
  /** Hide the bar synchronously (the legacy pre-capture hide). */
  hideBar: () => void
  /** Hand the finished argv to the launcher (which may defer the spawn). */
  launch: () => void
}

/**
 * Run the commit in the only allowed order.
 *
 * Synchronous by contract: neither hide may be deferred to a later tick.
 */
export function runCommit(sequence: CommitSequence): void {
  sequence.hideOverlay()
  sequence.hideBar()
  sequence.launch()
}
