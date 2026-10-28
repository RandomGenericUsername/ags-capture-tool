/**
 * The pure core of the capture tool's live appearance refresh (AD-27).
 *
 * The runtime invokes `palette-refresh <appearance-hash>` after the palette
 * pointer moved. Capture must converge on the new appearance WITHOUT closing
 * the active surface or rebuilding the widget tree that owns the shared UI
 * state. The surface the operator is using (screenshot, recording or settings),
 * the selected option groups, the settings draft and the one shared
 * `UiState` object all survive.
 *
 * WHAT CAPTURE ACTUALLY CACHES. Unlike the clipboard overlay there is no
 * token/texture map here. The stale thing is the generated icon art: every
 * icon is resolved through the platform registry and baked into a `Gtk.Image`
 * at widget-construction time. The refresh therefore has three ordered steps,
 * supplied by each window:
 *
 * 1. `clearCaches` — remove the current image widgets (the app's only
 *    palette-dependent rendering cache). Clearing FIRST is load-bearing: a
 *    rebuild that left the old child in place would either duplicate the icon
 *    or leave the old palette visible.
 * 2. `rebuildIcons` — resolve every icon slot again and build a fresh
 *    `Gtk.Image` from the regenerated file.
 * 3. `refreshWindow` — re-assert the layer-surface size after the icon pass.
 *    This only measures and sets a default size; it never maps, unmaps,
 *    hides, destroys or replaces the window.
 *
 * THE WINDOW SET IS UPDATED, NOT RECREATED. Destroying and rebuilding the
 * per-monitor windows would be a full reload, and it cannot be made safe
 * here: it would drop the active view/focus, the open inline path editor and
 * the pages' captured group lists. The registry below keeps one appearance
 * surface per live window, and a refresh fans out to all of them in place.
 * The residual is explicit: only icon widgets and the CSS pointer are
 * refreshed, not the structural widget tree. A future palette-dependent
 * non-icon widget must register its own rebuild in `AppearanceSurface`.
 *
 * PURE: no `ags`, no `gi://*`, no I/O. The GTK operations arrive as callbacks
 * so a stock-runner test executes the exact ordering and idempotence used by
 * app.tsx.
 */

/** The three window operations performed for one appearance. */
export interface AppearanceSurface {
  /** Drop the palette-dependent rendering caches (the built icon images). */
  clearCaches(): void
  /** Rebuild every icon image from the regenerated palette assets. */
  rebuildIcons(): void
  /** Re-assert window/surface sizing without mapping or hiding it. */
  refreshWindow(): void
}

/** What the platform's `createPaletteRefreshHandler` accepts as applied. */
export interface AppearanceApplied {
  status: "applied"
}

/** The live appearance surfaces, one per per-monitor window. */
export interface AppearanceRegistry {
  /** Register a window surface. Returns the matching unregister function. */
  register(surface: AppearanceSurface): () => void
  /** Surfaces in registration order. Read-only to callers. */
  surfaces(): readonly AppearanceSurface[]
}

/**
 * Run the non-destructive appearance refresh in its required order.
 *
 * A surface that throws leaves the other windows untouched only if the caller
 * catches per surface; `refreshAppAppearance()` does that deliberately, so one
 * bad window cannot strand the rest on the old palette. The throw is still
 * propagated there so the runtime records a retryable failure.
 */
export function applyAppearance(surface: AppearanceSurface): void {
  surface.clearCaches()
  surface.rebuildIcons()
  surface.refreshWindow()
}

/**
 * A registration list, not a singleton: the composition root owns the one
 * registry instance, and tests get their own.
 *
 * Unregistering is the window's `destroy` path (monitor hotplug). Without it a
 * removed monitor's window would stay in this list and the next refresh would
 * touch a destroyed widget.
 */
export function createAppearanceRegistry(): AppearanceRegistry {
  const registered: AppearanceSurface[] = []

  return {
    register(surface: AppearanceSurface): () => void {
      registered.push(surface)
      let active = true
      return () => {
        if (!active) return
        active = false
        const index = registered.indexOf(surface)
        if (index > -1) registered.splice(index, 1)
      }
    },
    surfaces(): readonly AppearanceSurface[] {
      return registered
    },
  }
}

/**
 * Wrap an appearance application as a hash-idempotent refresh.
 *
 * The same appearance hash does no work and still reports `applied`; a new
 * hash applies once. A throw is NOT recorded as applied, so the runtime's
 * ledger retries the same hash on its next trigger.
 */
export function createAppearanceRefresh(
  apply: () => void,
): (appearanceHash: string) => AppearanceApplied {
  let appliedHash: string | null = null

  return (appearanceHash: string): AppearanceApplied => {
    if (appearanceHash !== appliedHash) {
      apply()
      appliedHash = appearanceHash
    }
    return { status: "applied" }
  }
}
