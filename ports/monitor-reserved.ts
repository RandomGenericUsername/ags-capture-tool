// ---------------------------------------------------------------------------
// PORT: a monitor's reserved top edge (design.md §11.4, REQ-002).
//
// `domain/bar-placement.ts` owns the arithmetic; this port supplies the
// compositor fact. AstalHyprland is the primary source (push-capable), with
// `hyprctl -j monitors` as the documented fallback; both are adapter details.
//
// Interface only: no `ags/*`, no `gi://*`, no process spawn.
// ---------------------------------------------------------------------------

export interface MonitorReservedTop {
  /**
   * The top EXCLUSIVE zone in logical pixels for `connector`.
   *
   * Returns 0 when neither source can answer (the safe default: the bar still
   * opens; it simply cannot auto-slot). Never throws.
   */
  reservedTop(connector: string | null): number
}
