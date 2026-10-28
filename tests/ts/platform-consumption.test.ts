// ---------------------------------------------------------------------------
// Platform-consumption acceptance tests.
//
// These make the standalone app's platform contract executable rather than
// prose:
//
//   1. no app-local icon-registry copy; the platform IconProvider is used
//      (spine AD-7);
//   2. theming routes through the platform `Theme` port; no direct
//      `app.apply_css` call survives (spine AD-13);
//   3. no app -> app imports (spine AD-1): every relative import stays inside
//      this repo; the app depends on `ags-platform` and `contracts`, never on a
//      sibling app directory;
//   4. no bespoke event reader (spine AD-5).
//
// Source-text assertions, labelled as such: they pin wiring (which module a
// symbol is imported from), which is exactly what the acceptance criteria
// name. They do not execute the app.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve, relative } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")

const SKIP_DIRECTORIES = new Set([
  ".git",
  ".dev",
  ".worktrees",
  "@girs",
  "build",
  "dist",
  "node_modules",
  "templates",
  "tests",
])

/** Every app source file (`.ts`/`.tsx`), excluding generated/copied trees. */
function appSources(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRECTORIES.has(entry)) continue
      const full = resolve(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        out.push(full)
      }
    }
  }
  walk(ROOT)
  return out.sort()
}

function read(path: string): string {
  return readFileSync(path, "utf8")
}

function rel(path: string): string {
  return relative(ROOT, path)
}

// ---------------------------------------------------------------------------
// 1. The icon-registry copy is gone; the platform provider is used
// ---------------------------------------------------------------------------

test("no app-local icon-registry copy survives", () => {
  assert.equal(
    existsSync(resolve(ROOT, "lib/icon-registry.ts")),
    false,
    "lib/icon-registry.ts must be gone — the platform IconProvider (AD-7) replaces it",
  )
  assert.equal(
    existsSync(resolve(ROOT, "lib/theme.ts")),
    false,
    "lib/theme.ts must not exist — theming routes through the platform Theme port (AD-13)",
  )
})

test("the capture icons resolve through the platform IconProvider", () => {
  const icons = read(resolve(ROOT, "ui/shared/icons.ts"))
  assert.match(
    icons,
    /from "ags-platform\/adapters\/icon"/,
    "ui/shared/icons.ts must import the platform registry-backed IconProvider",
  )
  assert.match(
    icons,
    /registryProvider\.resolve\(/,
    "ui/shared/icons.ts must resolve the capture-tool group through registryProvider",
  )
})

// ---------------------------------------------------------------------------
// 2. Theming through the platform Theme port
// ---------------------------------------------------------------------------

test("the app applies its palette through the platform Theme port", () => {
  const app = read(resolve(ROOT, "app.tsx"))
  assert.match(
    app,
    /from "ags-platform\/adapters\/theme"/,
    "app.tsx must import the platform Theme adapter (AD-13)",
  )
  assert.match(app, /theme\.apply\(\)/, "app.tsx must call theme.apply()")
})

test("no direct app.apply_css call survives in the app", () => {
  for (const path of appSources()) {
    assert.equal(
      /app\.apply_css\(/.test(read(path)),
      false,
      `${rel(path)} still calls app.apply_css directly — theming must route through the Theme port`,
    )
  }
})

// ---------------------------------------------------------------------------
// 3. No app -> app imports (AD-1)
// ---------------------------------------------------------------------------

const IMPORT_RE = /(?:from|import)\s+["']([^"']+)["']/g

test("every relative import stays inside this repo (AD-1)", () => {
  const offenders: string[] = []
  for (const path of appSources()) {
    const text = read(path)
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1]
      // Bare specifiers (ags-platform, ags, gi://) are the allowed dependencies.
      if (!spec.startsWith(".")) continue
      const target = resolve(dirname(path), spec)
      if (target !== ROOT && !target.startsWith(ROOT + "/")) {
        offenders.push(`${rel(path)} -> ${spec}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `the app must depend only on ags-platform/contracts, never on a sibling repo (AD-1):\n${offenders.join("\n")}`,
  )
})

// ---------------------------------------------------------------------------
// 4. No bespoke event reader (AD-5)
// ---------------------------------------------------------------------------

test("no app-local event client survives", () => {
  const offenders = appSources().filter((p) => /(?:event-bus|events)\.ts$/.test(p))
  assert.deepEqual(
    offenders.map(rel),
    [],
    "the app must not carry its own event client — the platform's shared client is the one (AD-5)",
  )
})
