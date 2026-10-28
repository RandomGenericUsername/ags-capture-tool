/**
 * The one live appearance registry for this app process.
 *
 * `lib/appearance.ts` is the pure core; this module owns the process-wide
 * instance and the fan-out. Every `ClassicWindow` registers a surface when its
 * `<window>` `$` handler runs and unregisters on `destroy`, so the registry
 * tracks the live per-monitor window set automatically, including hotplug.
 *
 * The refresh continues through every window even when one throws, then
 * rethrows the first failure so `createPaletteRefreshHandler` answers with a
 * retryable protocol failure. A single bad surface must not leave the other
 * monitors on the old palette.
 */

import {
  applyAppearance,
  createAppearanceRegistry,
  type AppearanceSurface,
} from "../lib/appearance.ts"

export const appearanceRegistry = createAppearanceRegistry()

/** Refresh every live window in place. Active surfaces are never hidden. */
export function refreshAppAppearance(): void {
  let failure: unknown = null
  for (const surface of appearanceRegistry.surfaces()) {
    try {
      applyAppearance(surface)
    } catch (error) {
      if (failure === null) failure = error
      console.error(`capture-tool: palette refresh failed for one window: ${error}`)
    }
  }
  if (failure !== null) throw failure
}

/** Test seam: the same fan-out over a caller-supplied surface list. */
export function refreshSurfaces(surfaces: readonly AppearanceSurface[]): void {
  let failure: unknown = null
  for (const surface of surfaces) {
    try {
      applyAppearance(surface)
    } catch (error) {
      if (failure === null) failure = error
    }
  }
  if (failure !== null) throw failure
}
