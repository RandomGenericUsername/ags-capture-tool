// ---------------------------------------------------------------------------
// ADAPTER: the platform event bus as the app's live capture-state feed.
//
// This is the ONLY place in the capture tool that imports the Gio-backed
// `ags-platform/adapters/event-bus`, exactly as `ags-bar`'s recording widget
// does (design.md §11.7). The platform's shared client owns the D-Bus match
// rules, subscribe-before-read hydration, epoch/sequence ordering and the
// `Control` call; the app must not grow a second event reader (AD-5).
// ---------------------------------------------------------------------------

import { domainEvents } from "ags-platform/adapters/event-bus"
import { createCaptureStateFeed } from "../lib/capture-state-feed"
import type { CaptureStateFeed } from "../ports/capture-state-feed"

export function platformCaptureStateFeed(): CaptureStateFeed {
  return createCaptureStateFeed(domainEvents)
}
