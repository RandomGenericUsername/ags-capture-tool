// ---------------------------------------------------------------------------
// PORT: compositor client rectangles for the window pending pick (REQ-003).
//
// GTK4 has no global pointer API and no client list, so the hover ring must be
// driven by the compositor's own client rects (design.md §11.2). This port is
// the seam: the adapter reads AstalHyprland (`address, x, y, width, height,
// monitor, title`); the overlay/controller only ever sees plain `ClientRect`
// values and the event-local pointer coordinate.
//
// Interface only: no `ags/*`, no `gi://*`.
// ---------------------------------------------------------------------------

import type { ClientRect } from "../domain/selection"

export interface WindowClients {
  /** Fresh client rects. Called on every hover/click, never cached stale. */
  list(): ClientRect[]
  /** Structural changes (clients added/removed/moved) push a re-render. */
  subscribe(onChange: () => void): void
}
