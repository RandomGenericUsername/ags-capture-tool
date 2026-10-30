// ---------------------------------------------------------------------------
// PORT: the live capture-state feed (design.md §11.7, REQ-004).
//
// S4 is driven by the hub's `capture.state` domain event, not by backend
// stdout (the launcher discards it). This port names the three things the bar
// needs and nothing about where they come from:
//
//   subscribe   receive `{state, elapsed_seconds, job_id}` snapshots,
//               immediately hydrated with the current topic state;
//   onRestart   the hub's epoch restarted, so an old job is gone;
//   control     Pause/Resume/Stop through `hub.control(job_id, action)`.
//
// The platform's `DomainEventBusCore` is the ONE implementation (AD-5), so
// this is an interface only: no Gio, no `ags/*`, no I/O.
// ---------------------------------------------------------------------------

/** The contract payload plus the additive `job_id` (AD-34). */
export interface CaptureStatePayload {
  state?: unknown
  elapsed_seconds?: unknown
  job_id?: unknown
}

/** What the subscription seam may hand back: the raw payload object. */
export type CaptureStateHandler = (payload: CaptureStatePayload) => void

/**
 * The subset of the platform event bus this port consumes. `onRestart` and
 * `control` are optional exactly as the platform's `EventSource` declares
 * them, so a test (or a reduced client) can supply only what it needs.
 */
export interface CaptureStateSource {
  subscribe(
    topic: string,
    handler: (topic: string, payload: Record<string, unknown>) => void,
  ): () => void
  onRestart?(handler: () => void): () => void
  control?(jobId: string, action: string): void
}

export interface CaptureStateFeed {
  subscribe(handler: CaptureStateHandler): () => void
  onRestart(handler: () => void): () => void
  control(jobId: string, action: string): void
}
