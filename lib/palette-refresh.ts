/**
 * The app's palette-refresh handler wiring. PURE: no `ags`/`gi://*` imports, so
 * the stock-runner tests execute the SAME handler app.tsx registers.
 */

import { createPaletteRefreshHandler } from "ags-platform/ports/palette-refresh"
import type { PaletteRefreshRequestHandler } from "ags-platform/ports/palette-refresh"
import { createAppearanceRefresh } from "./appearance.ts"

export function createCapturePaletteRefresh(
  apply: () => void,
): PaletteRefreshRequestHandler {
  return createPaletteRefreshHandler(createAppearanceRefresh(apply))
}
