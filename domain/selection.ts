// ---------------------------------------------------------------------------
// DOMAIN: the selection vocabulary shared by the bar, the overlay and the argv
// translator (REQ-003, design.md §4/§11.3).
//
// A selection is a PENDING object until the shutter commits it. These helpers
// are deliberately geometry-only: no GTK, no GDK, no process, no I/O. The
// overlay turns pointer events into calls here, and the commit path turns the
// resulting value into `--geometry` / `--window` / `--monitor`.
//
// Coordinate space: every `Rect` here is in the compositor's LOGICAL display
// coordinates, the same space `gdk_monitor_get_geometry()`, `hyprctl clients`
// and `slurp` report. The overlay converts widget-local coordinates by adding
// its monitor origin; the backend receives the global rect.
// ---------------------------------------------------------------------------

/** A rectangle in logical display coordinates. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A compositor client, reduced to what the window picker needs. */
export interface ClientRect {
  /** Hyprland address (`0x…`), the reference handed to `--window`. */
  address: string
  /** `title || class || "window"`, already resolved by the adapter. */
  title: string
  /** Hyprland class, kept for a badge fallback and tests. */
  appClass: string
  /** Connector of the monitor the client is on, or null when unknown. */
  monitor: string | null
  /** Global client rectangle. */
  rect: Rect
}

/**
 * A finished, committable selection.
 *
 * The discriminant is the backend's target vocabulary, not an extra name:
 * `region` carries finished geometry, `window` carries a reference the backend
 * resolves at commit time (D8), `screen` carries the output name.
 */
export type Selection =
  | { kind: "region"; geometry: Rect }
  | { kind: "window"; address: string }
  | { kind: "screen"; monitor: string }

/**
 * The editable state of one target while the bar is open.
 *
 * `null` means "no pick yet": an empty region canvas, an unpinned window
 * picker, or the focused-monitor default for screen. It is what Esc clears on
 * its first rung (design.md §4.7).
 */
export type PendingPick =
  | { target: "region"; rect: Rect | null }
  | { target: "window"; address: string | null }
  | { target: "screen"; monitor: string | null }

/** The eight resize handles, in drawing order (corners then edges). */
export type ResizeHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"

export const HANDLE_ORDER: readonly ResizeHandle[] = [
  "nw",
  "ne",
  "se",
  "sw",
  "n",
  "e",
  "s",
  "w",
] as const

/** The CSS/mock geometry: 9px squares, centred on their anchor point. */
export const HANDLE_SIZE = 9
/** Hit radius around a handle centre. Generous on purpose: pointer targets. */
export const HANDLE_HIT_RADIUS = 9

function integer(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value))
}

/** Round and give the rect a positive, non-zero size. */
export function normalizeRect(rect: Rect): Rect {
  const x = integer(rect.x)
  const y = integer(rect.y)
  return {
    x,
    y,
    width: Math.max(1, integer(rect.width)),
    height: Math.max(1, integer(rect.height)),
  }
}

/** A rect from two drag corners, normalised so width/height are positive. */
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Rect {
  return normalizeRect({
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  })
}

/**
 * Confine a rect to one monitor (design.md §4 rule 4).
 *
 * Size is capped first, then the WHOLE rect is shifted inside, so moving a
 * selection past an edge keeps its size and stops at the edge instead of
 * collapsing to a 1px sliver. A 1px minimum is kept so a zero-area drag cannot
 * become a backend `WxH` of 0.
 */
export function clampRect(rect: Rect, bounds: Rect): Rect {
  const normalized = normalizeRect(rect)
  const left = integer(bounds.x)
  const top = integer(bounds.y)
  const boundsWidth = Math.max(1, integer(bounds.width))
  const boundsHeight = Math.max(1, integer(bounds.height))
  const width = clamp(normalized.width, 1, boundsWidth)
  const height = clamp(normalized.height, 1, boundsHeight)
  const x = clamp(normalized.x, left, left + boundsWidth - width)
  const y = clamp(normalized.y, top, top + boundsHeight - height)
  return { x, y, width, height }
}

/** Translate a rect by a drag delta, clamped to its hosting monitor. */
export function moveRect(rect: Rect, dx: number, dy: number, bounds: Rect): Rect {
  return clampRect(
    { ...rect, x: rect.x + integer(dx), y: rect.y + integer(dy) },
    bounds,
  )
}

/** Resize from one handle, clamped to the monitor and kept non-inverted. */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  bounds: Rect,
): Rect {
  const normalized = normalizeRect(rect)
  const left = integer(bounds.x)
  const top = integer(bounds.y)
  const right = left + Math.max(1, integer(bounds.width))
  const bottom = top + Math.max(1, integer(bounds.height))
  let x1 = normalized.x
  let y1 = normalized.y
  let x2 = normalized.x + normalized.width
  let y2 = normalized.y + normalized.height
  const ddx = integer(dx)
  const ddy = integer(dy)
  if (handle.includes("w")) x1 = clamp(x1 + ddx, left, x2 - 1)
  if (handle.includes("e")) x2 = clamp(x2 + ddx, x1 + 1, right)
  if (handle.includes("n")) y1 = clamp(y1 + ddy, top, y2 - 1)
  if (handle.includes("s")) y2 = clamp(y2 + ddy, y1 + 1, bottom)
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/** Centre points of the eight handles, in global coordinates. */
export function handlePoints(rect: Rect): Array<{ handle: ResizeHandle; x: number; y: number }> {
  const { x, y, width, height } = normalizeRect(rect)
  const midX = x + Math.floor(width / 2)
  const midY = y + Math.floor(height / 2)
  return [
    { handle: "nw", x, y },
    { handle: "ne", x: x + width, y },
    { handle: "se", x: x + width, y: y + height },
    { handle: "sw", x, y: y + height },
    { handle: "n", x: midX, y },
    { handle: "e", x: x + width, y: midY },
    { handle: "s", x: midX, y: y + height },
    { handle: "w", x, y: midY },
  ]
}

/** Top-left positions for the 9px handle widgets, in global coordinates. */
export function handlePositions(rect: Rect): Array<{ handle: ResizeHandle; x: number; y: number }> {
  const half = Math.floor(HANDLE_SIZE / 2)
  return handlePoints(rect).map((point) => ({
    handle: point.handle,
    x: point.x - half,
    y: point.y - half,
  }))
}

/**
 * The hit radius a rect's handles may occupy, per axis.
 *
 * A fixed 9px radius is right for a normal rect, but a ~15×15 rect has eight
 * handle zones that would cover its whole interior, leaving no place to grab
 * and move it. Clamp the radius to the rect's own size so the middle of the
 * rect is always a move surface: `(dimension - 1) / 3` leaves at least the
 * central third outside every handle, while corners/edges still own their own
 * neighbourhood. Normal rects keep the full 9px pointer target.
 */
function handleHitRadius(rect: Rect): { x: number; y: number } {
  const r = normalizeRect(rect)
  return {
    x: Math.min(HANDLE_HIT_RADIUS, Math.max(0, Math.floor((r.width - 1) / 3))),
    y: Math.min(HANDLE_HIT_RADIUS, Math.max(0, Math.floor((r.height - 1) / 3))),
  }
}

/** The handle under a point, or null. Corners win over edges. */
export function hitHandle(rect: Rect, x: number, y: number): ResizeHandle | null {
  const radius = handleHitRadius(rect)
  for (const point of handlePoints(rect)) {
    if (Math.abs(x - point.x) <= radius.x && Math.abs(y - point.y) <= radius.y) {
      return point.handle
    }
  }
  return null
}

/**
 * Classify a press on an existing region before a drag starts.
 *
 * Resize handles own only their own neighbourhood (see `handleHitRadius`), so
 * a minimal rect still has a move zone at its centre. A press outside every
 * handle and inside the rect moves the whole selection; a press outside the
 * rect returns null so the overlay can begin a fresh draw instead.
 */
export type RegionPress =
  | { kind: "resize"; handle: ResizeHandle }
  | { kind: "move" }

export function regionPressAt(rect: Rect, x: number, y: number): RegionPress | null {
  const handle = hitHandle(rect, x, y)
  if (handle !== null) return { kind: "resize", handle }
  if (containsPoint(rect, x, y)) return { kind: "move" }
  return null
}

export function containsPoint(rect: Rect, x: number, y: number): boolean {
  const r = normalizeRect(rect)
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
}

/** Overlap of two rects, or null when they do not intersect. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * The client under a global point.
 *
 * First match in compositor order. Called only with data the adapter read
 * fresh, so a vanished client simply stops matching.
 */
export function hitClient(clients: readonly ClientRect[], x: number, y: number): ClientRect | null {
  for (const client of clients) {
    if (containsPoint(client.rect, x, y)) return client
  }
  return null
}

/** Find a client by address (case-insensitive; Hyprland prints lowercase). */
export function clientByAddress(
  clients: readonly ClientRect[],
  address: string | null,
): ClientRect | null {
  if (address === null) return null
  const wanted = address.toLowerCase()
  return clients.find((client) => client.address.toLowerCase() === wanted) ?? null
}

/**
 * Where to place a badge above a rect, flipping below when there is no room and
 * keeping it inside the monitor.
 */
export function badgeAnchor(
  target: Rect,
  bounds: Rect,
  badgeWidth: number,
  badgeHeight: number,
): { x: number; y: number } {
  const margin = 8
  const gap = 10
  const left = bounds.x + margin
  const right = bounds.x + bounds.width - margin - badgeWidth
  const x = clamp(target.x, left, Math.max(left, right))
  const above = target.y - badgeHeight - gap
  const y =
    above >= bounds.y + margin
      ? above
      : clamp(target.y + target.height + gap, bounds.y + margin, bounds.y + bounds.height - margin - badgeHeight)
  return { x, y }
}

/**
 * Widget-local point -> global logical display point.
 *
 * The overlay is full-monitor and its widget origin is the monitor's GDK
 * logical origin, so this is a translation, not a scale. GDK monitor geometry,
 * `hyprctl` and `slurp` all speak logical coordinates; the backend receives the
 * translated global point regardless of the output's fractional scale. Negative
 * monitor origins (a monitor left of the primary) are ordinary values here.
 */
export function localToGlobal(
  localX: number,
  localY: number,
  monitor: Rect,
): { x: number; y: number } {
  return { x: monitor.x + localX, y: monitor.y + localY }
}

/** Global logical point -> widget-local point for one overlay. */
export function globalToLocal(
  globalX: number,
  globalY: number,
  monitor: Rect,
): { x: number; y: number } {
  return { x: globalX - monitor.x, y: globalY - monitor.y }
}

/** `W×H`, the badge/ARIA spelling (multiplication sign, not an x). */
export function formatSize(rect: Rect): string {
  const r = normalizeRect(rect)
  return `${r.width}×${r.height}`
}

/**
 * The backend's canonical geometry token: `X,Y WxH`.
 *
 * This is the ONE accepted spelling on the commit path (design.md §11.3);
 * `WxH+X+Y` belongs to the legacy slurp/recorder branches only.
 */
export function canonicalGeometry(rect: Rect): string {
  const r = normalizeRect(rect)
  return `${r.x},${r.y} ${r.width}x${r.height}`
}

/** The badge text for a committed region. */
export function regionBadge(rect: Rect | null): string {
  return rect === null ? "drag to select a region" : `${formatSize(rect)} · editable`
}

/** The badge text for a hovered/pinned window. */
export function windowBadge(client: ClientRect | null, pinned: boolean): string {
  if (client === null) return "hover a window · click to pin"
  const name = client.title || client.appClass || "window"
  return `${name} — ${formatSize(client.rect)}${pinned ? " · pinned" : " · click once to pin"}`
}

/** The badge text for the pending monitor. */
export function monitorBadge(index: number, width: number, height: number): string {
  return `Monitor ${index} — current pick · ${width}×${height} · whole screen, nothing excluded`
}
