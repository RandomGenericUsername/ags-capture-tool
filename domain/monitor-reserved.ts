// ---------------------------------------------------------------------------
// DOMAIN: read a monitor's reserved top edge out of `hyprctl -j monitors`
// (design.md §11.4 fallback, REQ-002).
//
// Hyprland reports `reserved` as [left, top, right, bottom]. The reference host
// reports [0, 48, 0, 0]: ags-bar's 48px EXCLUSIVE top zone. `reserved_top` from
// AstalHyprland is the primary source; this parser is the documented fallback
// and the one that can be executed in a stock-runner test.
//
// PURE: JSON in, number out. No process spawn here.
// ---------------------------------------------------------------------------

interface HyprctlMonitor {
  name?: unknown
  focused?: unknown
  reserved?: unknown
}

/**
 * The top reserved pixels for `connector`, or null when the payload is not a
 * monitor list / has no usable monitor.
 *
 * A named monitor wins; otherwise the focused monitor; otherwise the first.
 * A malformed `reserved` field is treated as "unknown", never as 0, so the
 * caller can fall through to its own fallback.
 */
export function reservedTopFromHyprctl(raw: string, connector: string | null): number | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null

  const monitors = parsed.filter(
    (entry): entry is HyprctlMonitor => entry !== null && typeof entry === "object",
  )
  if (monitors.length === 0) return null

  const chosen =
    (connector === null ? undefined : monitors.find((m) => m.name === connector)) ??
    monitors.find((m) => m.focused === true) ??
    monitors[0]

  const reserved = chosen.reserved
  if (!Array.isArray(reserved) || reserved.length < 2) return null
  const top = reserved[1]
  return typeof top === "number" && Number.isFinite(top) ? Math.max(0, Math.trunc(top)) : null
}
