// ---------------------------------------------------------------------------
// Overlay surface contract (design.md §11.2) — source assertions.
//
// GTK cannot be constructed under `node --test`, so this pins the layer-shell
// contract that IS readable: identity, layer, exclusivity, keymode, anchors,
// monitor binding, CSS-only chrome and the absence of a Cairo paint surface.
// The Esc/commit/refresh behaviour is executed separately.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

function read(...parts: string[]): string {
  return readFileSync(fileURLToPath(new URL(parts.join("/"), `file://${ROOT}/`)), "utf8")
}

function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
}

const OVERLAY = code(read("ui", "overlay", "SelectionOverlay.tsx"))
const CONTROLLER = code(read("ui", "overlay", "controller.ts"))
const APP = code(read("app.tsx"))
const CSS = read("style.css")
const BAR = code(read("ui", "classic", "ClassicWindow.tsx"))

test("the overlay is a separate window named capture-overlay", () => {
  assert.match(OVERLAY, /const OVERLAY_NAME = "capture-overlay"/)
  assert.match(OVERLAY, /name=\{OVERLAY_NAME\}/)
  assert.doesNotMatch(OVERLAY, /capture-window/, "the overlay must never reuse the bar's identity")
})

test("the bar keeps capture-window / OVERLAY / ON_DEMAND", () => {
  assert.match(BAR, /name="capture-window"/)
  assert.match(BAR, /layer=\{Astal\.Layer\.OVERLAY\}/)
  assert.match(BAR, /keymode=\{Astal\.Keymode\.ON_DEMAND\}/)
})

test("the overlay is TOP, IGNORE, NONE, full-anchored and monitor-bound", () => {
  assert.match(OVERLAY, /layer=\{Astal\.Layer\.TOP\}/)
  assert.match(OVERLAY, /exclusivity=\{Astal\.Exclusivity\.IGNORE\}/)
  assert.match(OVERLAY, /keymode=\{Astal\.Keymode\.NONE\}/)
  for (const anchor of ["TOP", "BOTTOM", "LEFT", "RIGHT"]) {
    assert.match(OVERLAY, new RegExp(`Astal\\.WindowAnchor\\.${anchor}`), `missing ${anchor} anchor`)
  }
  assert.match(OVERLAY, /gdkmonitor=\{gdkmonitor\}/)
  assert.match(OVERLAY, /margin_top=\{0\}/)
  assert.match(OVERLAY, /margin_bottom=\{0\}/)
  assert.match(OVERLAY, /margin_left=\{0\}/)
  assert.match(OVERLAY, /margin_right=\{0\}/)
})

test("overlay chrome is CSS-styled widgets, not Cairo", () => {
  assert.doesNotMatch(OVERLAY, /DrawingArea|Cairo|cairo|createSnapshot|snapshot/)
  assert.match(OVERLAY, /new Gtk\.Fixed\(\)/)
  assert.match(OVERLAY, /box\("selrect"\)/)
  assert.match(OVERLAY, /box\("selhandle"\)/)
  assert.match(OVERLAY, /box\("overlay-dim"\)/)
  assert.match(CSS, /window#capture-overlay/)
  assert.match(CSS, /\.selrect\s*\{/)
  assert.match(CSS, /\.selhandle\s*\{[^}]*min-width:\s*9px/)
  assert.match(CSS, /\.overlay-dim\s*\{/)
  assert.match(CSS, /\.selbadge\s*\{/)
})

test("the overlay is registered and unregistered with both registries", () => {
  assert.match(OVERLAY, /appearanceRegistry\.register\(\{/)
  assert.match(OVERLAY, /unregisterAppearance\(\)/)
  assert.match(OVERLAY, /controller\.register\(host\)/)
  assert.match(OVERLAY, /controller\.unregister\(host\)/)
  assert.match(OVERLAY, /self\.connect\("destroy"/)
})

test("the controller is GTK-free at runtime", () => {
  assert.doesNotMatch(CONTROLLER, /from "ags\//)
  assert.doesNotMatch(CONTROLLER, /from "gi:\/\//)
  // Only `import type` may name the platform ports.
  for (const line of CONTROLLER.split("\n").filter((l) => l.includes("import"))) {
    if (line.includes("ags/") || line.includes("gi://")) assert.match(line, /^import type/)
  }
})

test("the composition root builds a second, selection-driven overlay set", () => {
  assert.match(APP, /createOverlayWindowSet\(\{/)
  assert.match(APP, /createWindow: \(monitor\) => SelectionOverlay\(monitor, selection\)/)
  assert.match(APP, /createSelectionController\(\{/)
})

test("the overlay is absent outside an open mode", () => {
  // Both the host visibility and the window itself are driven by session.active.
  assert.match(OVERLAY, /view\.active && \(view\.target !== "region"/)
  assert.match(CONTROLLER, /active: session\.active/)
})
