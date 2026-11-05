// ---------------------------------------------------------------------------
// PORT: the shared monitor catalog (EPIC-002 §2.2/§2.4, REQ-011).
//
// `dotfiles-runtime monitors list --format json` is the language-agnostic
// service; this port is the capture tool's seam onto it. The GDK topology
// remains the authority for which outputs the app can actually target, so this
// catalog only ENRICHES the list: labels, geometry, focus and canonical order.
//
// Interface only: no `ags/*`, no `gi://*`, no I/O (gate check 1).
// ---------------------------------------------------------------------------

/** One output as the runtime reports it (`schema_version: 1`). */
export interface CatalogMonitor {
  /** Stable output id; the exact value the backend takes for `--monitor`. */
  connector: string
  /** `description` when non-empty, else `connector` (contract §2.2). */
  label: string
  description: string
  make: string
  model: string
  serial: string
  /** Compositor logical rectangle; display/join data, not capture math. */
  geometry: {
    x: number
    y: number
    width: number
    height: number
  }
  scale: number
  transform: number
  /** Compositor focus; used only when the focus port has no answer. */
  focused: boolean
  mirror_of: string | null
}

/** Read the connected, enabled, non-mirrored outputs. */
export interface MonitorCatalog {
  /**
   * The catalog rows, or `[]` when the runtime is missing/slow/invalid.
   *
   * NEVER rejects: the bar must keep working from the GDK descriptors on a host
   * without the runtime command (hard rule for REQ-011). Implementations may
   * cache; a failure is a normal "no enrichment" answer, not a UI error.
   */
  list(): Promise<CatalogMonitor[]>
}
