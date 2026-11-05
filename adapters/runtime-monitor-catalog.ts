// ---------------------------------------------------------------------------
// ADAPTER: `dotfiles-runtime monitors list --format json` (REQ-011).
//
// The command is read-only and safe on a headless host: a missing binary, a
// non-zero exit, invalid JSON or `schema_version != 1` all answer `[]`. That is
// the documented GDK fallback, not an error the UI must handle.
//
// The exec function is injected by the composition root (`app.tsx` passes
// `execAsync` from `ags/process`). Keeping this module free of a platform
// import is what lets the cache/validation/fake-CLI tests run under plain Node;
// the port still sees only a `Promise<CatalogMonitor[]>` that never rejects.
//
// Cache: 2 seconds, including failures. The Monitor popover re-reads on open
// and on a GDK topology change, so a missing runtime must not spawn a process
// on every keystroke or repaint.
// ---------------------------------------------------------------------------

import { parseCatalogPayload } from "../domain/monitor-catalog"
import type { CatalogMonitor, MonitorCatalog } from "../ports/monitor-catalog"

/** The one machine-readable contract; the composition root supplies exec. */
export const MONITOR_CATALOG_ARGV = [
  "dotfiles-runtime",
  "monitors",
  "list",
  "--format",
  "json",
] as const

/** `execAsync`-compatible: argv in, stdout out. */
export type MonitorCatalogExec = (argv: readonly string[]) => Promise<string>

export const MONITOR_CATALOG_CACHE_MS = 2000

export function runtimeMonitorCatalog(
  execAsync: MonitorCatalogExec,
  now: () => number = Date.now,
): MonitorCatalog {
  let cached: CatalogMonitor[] | null = null
  let cachedAt = 0
  let inFlight: Promise<CatalogMonitor[]> | null = null

  async function read(): Promise<CatalogMonitor[]> {
    try {
      return parseCatalogPayload(await execAsync(MONITOR_CATALOG_ARGV))
    } catch {
      // Missing CLI, non-zero exit, spawn failure: the GDK fallback is the
      // answer. Never let this reject into the bar.
      return []
    }
  }

  return {
    list(): Promise<CatalogMonitor[]> {
      const at = now()
      if (cached !== null && at - cachedAt < MONITOR_CATALOG_CACHE_MS) {
        return Promise.resolve(cached)
      }
      if (inFlight !== null) return inFlight
      inFlight = read()
        .then((monitors) => {
          cached = monitors
          cachedAt = now()
          return monitors
        })
        .finally(() => {
          inFlight = null
        })
      return inFlight
    },
  }
}
