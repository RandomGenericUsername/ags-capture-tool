// ---------------------------------------------------------------------------
// Manifest + handler + template conformance for ags-capture-tool
// (AD-26/AD-27/AD-33/AD-35, REQ-011).
//
// This is the repo-local gate the standalone contract requires:
//   1. `app.manifest.json` is schema-valid and carries the capture identity;
//   2. app.tsx / window / stylesheet / launcher / keybind agree with it;
//   3. the live palette-refresh handler is real: it re-applies the Theme
//      pointer AND reloads generated icons in every live per-monitor window,
//      without closing the active surface or resetting shared UI state;
//   4. the shared dev-flow template (AGENTS, tickets, guard, Makefile, CI,
//      tests, templates/ags-app) is present and the platform's own
//      `checkAppRepo` template gate passes;
//   5. the Python backend/bin and the copied backend tests are preserved.
//
// Run from the repo root:  make conformance
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseAgsAppManifest } from "ags-platform/ports/app-manifest"
import {
  checkAppRepoAt,
  formatAppConformanceReport,
} from "ags-platform/conformance/app-conformance"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const IDENTITY = {
  schemaVersion: 1,
  app: "capture",
  instance: "capture",
  configDir: "ags-capture",
  mode: "live",
  holdsUnsavedState: false,
}

function readText(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8")
}

/** Strip comments, keeping strings intact (same shape as ags-apps' gate). */
function stripComments(source) {
  let out = ""
  let state = null
  let i = 0
  while (i < source.length) {
    const c = source[i]
    const next = source[i + 1]
    if (state === "line") {
      if (c === "\n") {
        state = null
        out += c
      }
      i += 1
      continue
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = null
        i += 2
      } else {
        i += 1
      }
      continue
    }
    if (state === "'" || state === '"' || state === "`") {
      out += c
      if (c === "\\") {
        out += next ?? ""
        i += 2
        continue
      }
      if (c === state) state = null
      i += 1
      continue
    }
    if (c === "/" && next === "/") {
      state = "line"
      i += 2
      continue
    }
    if (c === "/" && next === "*") {
      state = "block"
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === "`") state = c
    out += c
    i += 1
  }
  return out
}

/** The `{...}` body of the function named by `marker`, comments stripped. */
function functionBody(source, marker) {
  const clean = stripComments(source)
  const start = clean.indexOf(marker)
  assert.notEqual(start, -1, `missing function marker: ${marker}`)
  const brace = clean.indexOf("{", start)
  assert.notEqual(brace, -1, `missing function body for: ${marker}`)
  let depth = 0
  let state = null
  for (let i = brace; i < clean.length; i += 1) {
    const c = clean[i]
    if (state !== null) {
      if (c === "\\") {
        i += 1
      } else if (c === state) {
        state = null
      }
      continue
    }
    if (c === "'" || c === '"' || c === "`") {
      state = c
      continue
    }
    if (c === "{") depth += 1
    if (c === "}") {
      depth -= 1
      if (depth === 0) return clean.slice(brace + 1, i)
    }
  }
  throw new Error(`unterminated function body: ${marker}`)
}

function findContractsRoot() {
  const override = process.env.CONTRACTS_ROOT
  if (override) return override
  let dir = ROOT
  for (let i = 0; i < 8; i += 1) {
    dir = dirname(dir)
    if (existsSync(join(dir, "contracts", "schemas", "ags-app-manifest.schema.json"))) {
      return join(dir, "contracts")
    }
  }
  return null
}

/** Every authored file, minus generated/local-only/copied-template trees. */
function walk(dir = ROOT) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      [
        ".git",
        ".dev",
        ".worktrees",
        "@girs",
        "build",
        "dist",
        "node_modules",
        "templates",
        "__pycache__",
        ".pytest_cache",
      ].includes(entry.name)
    ) {
      continue
    }
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(absolute))
    else if (entry.isFile()) files.push(relative(ROOT, absolute).split("\\").join("/"))
  }
  return files
}

/** App source files only: no tests, docs, copied template or generated tree. */
function appSources() {
  return walk().filter(
    (file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file) && !file.startsWith("tests/"),
  )
}

// ── 1. Manifest identity ───────────────────────────────────────────────────

test("the manifest is schema-valid and carries the capture identity", () => {
  const parsed = parseAgsAppManifest(readText("app.manifest.json"))
  assert.equal(parsed.ok, true, JSON.stringify(parsed.issues ?? []))
  assert.deepEqual(parsed.manifest, IDENTITY)
})

test("the manifest agrees with app.tsx and the per-monitor window", () => {
  const app = readText("app.tsx")
  const window = readText("ui", "classic", "ClassicWindow.tsx")
  assert.match(app, /instanceName:\s*"capture"/)
  assert.match(window, /const WINDOW_NAME = "capture-window"/)
  assert.match(window, /name="capture-window"/)
  assert.match(readText("style.css"), /window#capture-window/)
})

test("the launcher and keybind description are documented for consumers", () => {
  const readme = readText("README.md")
  assert.match(readme, /`ags-capture-tool`/)
  assert.match(readme, /`capture-ui`/)
  assert.match(readme, /Open capture UI/)
  assert.match(readme, /`ags-capture`/)
})

test("no unresolved template token survives in the app tree", () => {
  const token = new RegExp("\\{\\{[A-Z_]+\\}\\}")
  const offenders = walk()
    .filter((file) => !file.startsWith("tests/"))
    .filter((file) => token.test(readText(file)))
  assert.deepEqual(offenders, [], `unresolved template token in: ${offenders.join(", ")}`)
})

// ── 2. Repository template + platform conformance ──────────────────────────

test("the platform template gate passes for this repo", () => {
  const report = checkAppRepoAt(ROOT)
  assert.equal(report.ok, true, formatAppConformanceReport(report, ROOT))
})

test("the frozen copyable template is present for the next app", () => {
  const template = join(ROOT, "templates", "ags-app")
  const required = [
    "AGENTS.md",
    "README.md",
    "Makefile",
    "app.tsx",
    "app.manifest.json",
    "tsconfig.app.json",
    "scripts/worktree-guard.sh",
    "tickets/LIFECYCLE.md",
    "tickets/INDEX.md",
    "tickets/_template/requirement.md",
    "tests/app-contract.test.mjs",
    "tests/unit.test.mjs",
    ".github/workflows/ci.yml",
  ]
  for (const path of required) {
    assert.ok(existsSync(join(template, path)), `templates/ags-app/${path} is missing`)
  }
  for (const token of ["{{APP}}", "{{INSTANCE}}", "{{CONFIG_DIR}}", "{{REPO}}"]) {
    assert.match(
      readText("templates", "ags-app", "template.json"),
      new RegExp(token.replace(/[{}]/g, "\\$&")),
      `template.json must declare ${token}`,
    )
  }
})

test("the contracts v0.3.0 manifest schema agrees with the platform", () => {
  const contractsRoot = findContractsRoot()
  assert.notEqual(contractsRoot, null, "cannot find contracts (set CONTRACTS_ROOT)")
  const schema = JSON.parse(
    readFileSync(join(contractsRoot, "schemas", "ags-app-manifest.schema.json"), "utf8"),
  )
  assert.equal(schema.properties.schemaVersion.const, 1)
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(
    [...schema.required].sort(),
    ["app", "configDir", "holdsUnsavedState", "instance", "mode", "schemaVersion"],
  )
  assert.equal(
    schema.allOf[0].then.properties.holdsUnsavedState.const,
    false,
    "restart stays invalid when holdsUnsavedState is true",
  )
})

test("the Makefile pins the v0.3.0 program tuple", () => {
  const makefile = readText("Makefile")
  assert.match(makefile, /^AGS_PLATFORM_VERSION := v0\.3\.0$/m)
  assert.match(makefile, /^CONTRACTS_VERSION := v0\.3\.0$/m)
})

// ── 3. The live handler is real and non-destructive ────────────────────────

test("app.tsx registers the real palette-refresh handler, not a Theme-only ack", () => {
  const app = readText("app.tsx")
  assert.match(app, /from\s+"\.\/lib\/palette-refresh"/)
  assert.match(app, /createCapturePaletteRefresh\(/)
  assert.match(app, /requestHandler:\s*paletteRefresh/)
  assert.match(app, /theme\.apply\(\)/, "the stable Theme pointer is re-applied")
  assert.match(app, /refreshAppAppearance\(\)/, "the generated icons/windows are refreshed")
})

test("the refresh clears icon caches before rebuilding icons and re-measuring", () => {
  const appearance = readText("lib", "appearance.ts")
  const body = functionBody(appearance, "export function applyAppearance")
  const clear = body.indexOf("clearCaches()")
  const icons = body.indexOf("rebuildIcons()")
  const window = body.indexOf("refreshWindow()")
  assert.ok(clear > -1 && icons > -1 && window > -1, "all three refresh steps must exist")
  assert.ok(clear < icons, "cache clear must happen before the icon rebuild")
  assert.ok(icons < window, "the window is re-measured after the icon rebuild")
})

test("every live window registers an icon-rebuilding, size-reasserting surface", () => {
  const window = readText("ui", "classic", "ClassicWindow.tsx")
  assert.match(window, /createIconSlots\(\)/)
  assert.match(window, /appearanceRegistry\.register\(\{/)
  assert.match(window, /clearCaches:\s*\(\)\s*=>\s*iconSlots\.clear\(\)/)
  assert.match(window, /rebuildIcons:\s*\(\)\s*=>\s*iconSlots\.refresh\(\)/)
  assert.match(window, /refreshWindow:\s*syncWindowSize/)
  assert.match(window, /self\.connect\("destroy"/, "a removed monitor's surface must unregister")
  assert.match(window, /unregisterAppearance\(\)/)
  assert.match(window, /icons=\{iconSlots\}/, "the pages receive the window's icon slots")
})

test("the icon refresh replaces only the image child", () => {
  const icons = readText("ui", "shared", "icons.ts")
  const refresh = functionBody(icons, "const refresh = ()")
  assert.match(refresh, /clear\(\)/)
  assert.match(refresh, /captureIcon\(variant, size\)/)
  assert.match(refresh, /self\.prepend\(icon\)/)
  assert.doesNotMatch(refresh, /set_text|set_visible|\.visible\s*=/)
  assert.doesNotMatch(refresh, /destroy|remove_window|add_window/)
})

test("the refresh never closes, hides, destroys or rebuilds the per-monitor windows", () => {
  const appearance = readText("ui", "appearance.ts")
  const refresh = functionBody(appearance, "export function refreshAppAppearance")
  assert.doesNotMatch(refresh, /\.visible\s*=/)
  assert.doesNotMatch(refresh, /\.hide\(|\.show\(|\.present\(/)
  assert.doesNotMatch(refresh, /destroy|remove_window|add_window|createMonitorWindowSet/)
  assert.match(refresh, /applyAppearance\(surface\)/)

  const window = readText("ui", "classic", "ClassicWindow.tsx")
  const surface = functionBody(window, "unregisterAppearance = appearanceRegistry.register")
  assert.doesNotMatch(surface, /mode\s*=|view\s*=|state\s*=|\.visible\s*=/)
  assert.doesNotMatch(surface, /createUiState\(|Object\.assign\(/)
})

test("the refresh does not reset selection, draft or the shared UI state", () => {
  const window = readText("ui", "classic", "ClassicWindow.tsx")
  const surface = functionBody(window, "unregisterAppearance = appearanceRegistry.register")
  assert.doesNotMatch(surface, /applyGroup\(/)
  assert.doesNotMatch(surface, /uiStateStore\.(load|save)\(/)
  assert.doesNotMatch(surface, /settingsStore\.(load|save)\(/)
  assert.doesNotMatch(surface, /settingsPage|screenshotPage|recordingPage/)

  const app = readText("app.tsx")
  const refresh = functionBody(app, "const paletteRefresh = createCapturePaletteRefresh")
  assert.doesNotMatch(refresh, /createUiState\(/)
  assert.doesNotMatch(refresh, /windowSet|get_monitors\(\)/)
})

test("no source subscribes to wallpaper.state for palette application", () => {
  const forbidden = new RegExp("wallpaper" + "\\.state")
  const offenders = appSources().filter((file) => forbidden.test(readText(file)))
  assert.deepEqual(offenders, [], `wallpaper.state must not drive this app: ${offenders.join(", ")}`)
})

// ── 4. Backend preservation ────────────────────────────────────────────────

test("the Python backend and its pytest suites are preserved", () => {
  const bin = join(ROOT, "bin", "capture-tool")
  assert.ok(existsSync(bin), "bin/capture-tool is missing")
  assert.match(readFileSync(bin, "utf8"), /^#!\/usr\/bin\/env python3/m)
  for (const suite of [
    "test_capture_tool_cli.py",
    "test_capture_settings.py",
    "test_notify.py",
  ]) {
    assert.ok(existsSync(join(ROOT, "tests", "python", suite)), `tests/python/${suite} is missing`)
  }
  assert.match(readText("pytest.ini"), /testpaths\s*=\s*tests\/python/)
})
