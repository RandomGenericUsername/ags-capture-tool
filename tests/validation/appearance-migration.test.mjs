#!/usr/bin/env node
// Source-level v2 Appearance migration gate (REQ-016).
//
// The capture app consumes the unified appearance plane without redesigning the
// bar: the platform adapter installs one composed provider and owns the single
// watched hop, while this app only applies it and rebuilds its own derived
// widgets. These assertions pin the app-side contract so a later change cannot
// silently re-introduce the split Theme/Skin pair, a second refresh path, a new
// request command, or drop the bundled fallback:
//
//   1. app.tsx declares one createAppearance scoped to ags-capture;
//   2. main() applies the appearance once; no theme/skin call survives;
//   3. the palette-refresh handler is createAppearanceRefreshHandler(appearance,
//      work) where work only runs refreshAppAppearance();
//   4. the capture request surface (screenshot/record/settings + cluster) is
//      unchanged and no new request command is added;
//   5. the panel width is CSS-owned: no capture layout token or widthRequest
//      plumbing survives in TSX;
//   6. style.css still carries the bundled glass fallback and --rec-accent.
//
// Static, no desktop stack needed.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")

const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8")

/**
 * Strip comments before scanning. The appearance contract is documented in
 * prose that names the old Theme/Skin pair and the refresh paths; raw text
 * would make documentation read as the behavior it describes.
 */
function stripComments(text) {
  let out = ""
  let state = null // "line" | "block" | a quote character
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
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
    if (state !== null) {
      out += c
      if (c === "\\") {
        out += next ?? ""
        i += 1
      } else if (c === state) {
        state = null
      }
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
  for (let i = brace; i < clean.length; i++) {
    if (clean[i] === "{") depth += 1
    if (clean[i] === "}") {
      depth -= 1
      if (depth === 0) return clean.slice(brace + 1, i)
    }
  }
  throw new Error(`unterminated function body: ${marker}`)
}

const app = stripComments(read("app.tsx"))
const window = stripComments(read("ui", "classic", "ClassicWindow.tsx"))
const settings = stripComments(read("ui", "classic", "SettingsPage.tsx"))

// ── 1. One app-scoped Appearance ──────────────────────────────────────────

assert.match(
  app,
  /import \{ createAppearance \} from "ags-platform\/adapters\/appearance"/,
  "app.tsx must import the app-scoped Appearance factory",
)
assert.match(
  app,
  /const appearance = createAppearance\(\{\s*configDir: "ags-capture",?\s*\}\)/,
  "the module-level appearance must be scoped to the ags-capture config dir",
)
assert.equal(
  (app.match(/createAppearance\(/g) ?? []).length,
  1,
  "exactly one app-scoped appearance is created",
)

// ── 2. Startup applies the whole appearance; the split pair is gone ───────

const mainStart = app.indexOf("main()")
assert.ok(mainStart >= 0, "app.tsx lost main()")
const main = app.slice(mainStart)
assert.equal(
  (main.match(/appearance\.apply\(\)/g) ?? []).length,
  1,
  "the appearance is applied exactly once at startup",
)

for (const forbidden of [
  /createAppSkin|createAppSkinValue/,
  /ags-platform\/adapters\/(?:theme|skin)/,
  /\btheme\.apply\(\)/,
  /\bskin\.apply\(\)/,
]) {
  assert.doesNotMatch(
    app,
    forbidden,
    `app.tsx still reaches the retired Theme/Skin plane: ${forbidden}`,
  )
}

// ── 3. The refresh handler is the platform appearance helper ──────────────

assert.match(
  app,
  /const paletteRefresh = createAppearanceRefreshHandler\(appearance,/,
  "the palette-refresh wiring must use createAppearanceRefreshHandler(appearance, work)",
)
assert.doesNotMatch(app, /skin-refresh|SKIN_REFRESH/)
assert.doesNotMatch(app, /wallpaper\.state/)

const refresh = functionBody(app, "const paletteRefresh = createAppearanceRefreshHandler")
assert.match(refresh, /refreshAppAppearance\(\)/, "the capture surface fan-out is kept")
assert.doesNotMatch(
  refresh,
  /\b(?:theme|skin)\.apply\(\)/,
  "the platform helper already re-applies the whole appearance",
)
assert.doesNotMatch(
  refresh,
  /appearance\.apply\(\)/,
  "work must not double-apply; the helper owns the appearance apply",
)

// ── 4. Existing request surface, no new command ───────────────────────────

assert.equal(
  (app.match(/^\s{2}requestHandler,$/gm) ?? []).length,
  1,
  "keep exactly one request handler; Appearance adds no request path",
)
assert.equal(
  (app.match(/createCaptureRequestHandler\(/g) ?? []).length,
  1,
  "the existing capture request handler must be the only handler built",
)
assert.match(
  app,
  /const requestHandler = createCaptureRequestHandler\(paletteRefresh,/,
  "the one request handler stays wired to the palette refresh",
)
assert.match(
  app,
  /createClusterRequestHandler\(clusterController\)/,
  "the existing capture-cluster request command stays wired",
)
assert.doesNotMatch(
  app,
  /PALETTE_REFRESH_COMMAND|CAPTURE_CLUSTER_COMMAND/,
  "request command dispatch stays in lib/request-dispatch, not app.tsx",
)

// ── 5. Panel width is CSS-owned, with no capture layout token ─────────────

assert.doesNotMatch(
  app,
  /layout\.ags-capture\.panel-width/,
  "app.tsx must not read the removed capture layout token",
)
assert.doesNotMatch(
  app,
  /appearance\.value\(/,
  "the app must not read any capture layout token",
)
assert.match(
  app,
  /ClassicWindow\(monitor, ports, state, selection\)/,
  "the window is constructed without a panel-width argument",
)
assert.doesNotMatch(
  window,
  /panelWidth/,
  "ClassicWindow must not plumb a panel-width prop",
)
assert.doesNotMatch(
  settings,
  /panelWidth|widthRequest/,
  "SettingsPage relies on style.css min-width instead of requesting a width",
)

// ── 6. Bundled glass fallback and recording accent survive ────────────────

assert.match(app, /import style from "\.\/style\.css"/)
assert.match(app, /css:\s*style,/)
const css = read("style.css")
assert.match(
  css,
  /--rec-accent:\s*@error;/,
  "style.css must keep its local --rec-accent fallback",
)
assert.match(css, /window#capture-window/, "style.css must keep the shared window selector")
assert.match(
  css,
  /\.capture-panel\s*\{[^}]*min-width:\s*560px/s,
  "style.css must keep the panel width fallback",
)
assert.match(
  css,
  /\.capture-panel\s*\{[^}]*background-color:\s*alpha\(@surface,\s*0\.92\)/s,
  "style.css must keep the glass panel fallback",
)
assert.match(
  css,
  /\.settings-page\s*\{[^}]*min-width:\s*560px/s,
  "style.css must keep the settings panel width fallback",
)
