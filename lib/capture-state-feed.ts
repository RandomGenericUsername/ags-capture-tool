// ---------------------------------------------------------------------------
// The app-side binding of the capture-state port to the platform event bus.
//
// DESKTOP-FREE ON PURPOSE. The only Gio import lives in
// `adapters/platform-capture-state-feed.ts`; this file takes the source as a
// parameter, so `tests/ts/capture-state-feed.test.ts` can drive the exact
// subscription/control wiring with a mocked hub under plain Node.
//
// It adds no state of its own: `subscribe` forwards the platform's own
// subscribe-before-read hydration, `onRestart` forwards the epoch reset, and
// `control` refuses a call without a job id instead of asking the hub to
// resolve an empty string. Nothing here derives time or capture state.
// ---------------------------------------------------------------------------

import type {
  CaptureStateFeed,
  CaptureStatePayload,
  CaptureStateSource,
} from "../ports/capture-state-feed"

/** The one `capture.state` topic literal (platform contract, AD-5). */
export const CAPTURE_STATE_TOPIC = "capture.state"

export function createCaptureStateFeed(source: CaptureStateSource): CaptureStateFeed {
  return {
    subscribe(handler): () => void {
      return source.subscribe(CAPTURE_STATE_TOPIC, (_topic, payload) => {
        handler(payload as CaptureStatePayload)
      })
    },
    onRestart(handler): () => void {
      return source.onRestart?.(handler) ?? (() => {})
    },
    control(jobId, action): void {
      if (jobId === "") return
      source.control?.(jobId, action)
    },
  }
}
