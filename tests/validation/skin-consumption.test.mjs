#!/usr/bin/env node
// Source-level skin-consumption gate (REQ-015).
//
// The skin plane is app-scoped: the platform v0.8.0 adapter resolves
// `$XDG_CONFIG_HOME/<configDir>/skin.css` for this app's `ags-capture` config
// directory. These assertions pin the wiring the requirement names, not a
// rendered result (GTK is not available to the stock runner):
//
//   1. one module-level `createAppSkin({ configDir: "ags-capture" })`;
//   2. `skin.apply()` immediately after `theme.apply()` in `main()`;
//   3. the existing palette-refresh handler and its single request handler are
//      unchanged — the adapter's own monitor reloads skin.css;
//   4. `style.css` is still the bundled glass fallback;
//   5. no layout token accessor is introduced (layout stays TSX-owned).
//
// Static, no desktop stack needed.

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const APP = resolve(ROOT, "app.tsx")
const STYLE = resolve(ROOT, "style.css")

const app = readFileSync(APP, "utf8")

/** Strip comments and strings while keeping braces, enough for a body match. */
function stripComments(source) {
  let out = ""
  let state = null
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i]
    const next = source[i + 1]
    if (state === "line") {
      if (c === "\n") {
        state = null
        out += c
      }
      continue
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = null
        i += 1
      }
      continue
    }
    if (state === "'" || state === '"' || state === "`") {
      if (c === "\\") i += 1
      else if (c === state) state = null
      out += c
      continue
    }
    if (c === "/" && next === "/") {
      state = "line"
      i += 1
      continue
    }
    if (c === "/" && next === "*") {
      state = "block"
      i += 1
      continue
    }
    if (c === "'" || c === '"' || c === "`") state = c
    out += c
  }
  return out
}

/** The `{...}` body of the first function matching `marker`, comments stripped. */
function functionBody(source, marker) {
  const clean = stripComments(source)
  const start = clean.indexOf(marker)
  assert.notEqual(start, -1, `missing function marker: ${marker}`)
  const brace = clean.indexOf("{", start)
  assert.notEqual(brace, -1, `missing function body for: ${marker}`)
  let depth = 0
  for (let i = brace; i < clean.length; i += 1) {
    if (clean[i] === "{") depth += 1
    if (clean[i] === "}") {
      depth -= 1
      if (depth === 0) return clean.slice(brace + 1, i)
    }
  }
  throw new Error(`unterminated function body: ${marker}`)
}

// ── 1+2. Module-level skin and theme-then-skin order in main() ─────────────

assert.match(
  app,
  /^import \{ createAppSkin \} from "ags-platform\/adapters\/skin"$/m,
  "app.tsx must import the platform app-scoped Skin adapter",
)

assert.match(
  app,
  /^const skin = createAppSkin\(\{\s*configDir:\s*"ags-capture"\s*\}\)$/m,
  'app.tsx must build one module-level createAppSkin({ configDir: "ags-capture" })',
)

const main = functionBody(app, "main() {")
const themeAt = main.indexOf("theme.apply()")
const skinAt = main.indexOf("skin.apply()")
assert.notEqual(themeAt, -1, "main() must apply the palette")
assert.notEqual(skinAt, -1, "main() must apply the skin")
assert.ok(
  themeAt < skinAt,
  "skin.apply() must run immediately after theme.apply(), never before it",
)

// ── 3. Existing refresh lane, no skin-refresh request ──────────────────────

const refresh = functionBody(app, "const paletteRefresh = createCapturePaletteRefresh")
assert.match(refresh, /theme\.apply\(\)/, "the palette-refresh handler still re-applies the palette")
assert.match(refresh, /refreshAppAppearance\(\)/, "the palette-refresh handler still refreshes windows")

assert.equal(
  (app.match(/^\s{2}requestHandler,$/gm) ?? []).length,
  1,
  "app.tsx must keep exactly the one existing requestHandler registration",
)
assert.equal(
  (app.match(/createCaptureRequestHandler\(/g) ?? []).length,
  1,
  "the existing capture request handler must be the only handler built",
)
assert.match(
  app,
  /const requestHandler = createCaptureRequestHandler\(paletteRefresh,/,
  "the one request handler stays wired to the existing palette refresh",
)
assert.doesNotMatch(
  app,
  /skin[-_ ]?(refresh|reload)|createSkinRefresh/i,
  "a skin-refresh request must not be added; the adapter monitor reloads skin.css",
)

// ── 4. The bundled glass fallback is still present ─────────────────────────

assert.ok(existsSync(STYLE), "style.css must remain the bundled glass fallback")
const style = readFileSync(STYLE, "utf8")
assert.match(app, /^import style from "\.\/style\.css"$/m, "app.tsx must keep importing style.css")
assert.match(app, /css:\s*style,/, "app.start must keep installing the bundled style.css")
assert.match(style, /--rec-accent:\s*@error;/, "style.css must keep its local --rec-accent fallback")
assert.match(style, /window#capture-window/, "style.css must keep the shared window selector")

// ── 5. Layout tokens stay TSX-owned ────────────────────────────────────────

assert.doesNotMatch(
  app,
  /createAppSkinValue|skinValue\(/,
  "v1 consumes no layout tokens: app.tsx must not add a skin layout accessor",
)
