#!/usr/bin/env node
// Semantic-role gate (REQ-005).
//
// The capture stylesheet was written against CSG's positional `@color_00..15`
// carrier names. Under tpr those carriers resolve to unrelated Material roles,
// so a carrier-index migration would silently break state colors. This gate
// pins the outcome instead: no CSS/TS/TSX file may reference a legacy carrier,
// and `style.css` must use the `palette.v1` role names the platform's composed
// provider defines.
//
// Static, no desktop stack needed.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, relative, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGS = resolve(HERE, "../..");

const SKIP_DIRS = new Set([".git", "node_modules", "@girs", "build", ".dev", ".worktrees"]);
const EXTENSIONS = new Set([".css", ".ts", ".tsx"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const legacy = [];
for (const file of walk(AGS)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/@color_[a-z0-9_]+/g)) {
    legacy.push(`${relative(AGS, file)}: ${match[0]}`);
  }
}

assert.deepEqual(
  legacy,
  [],
  "legacy @color_* carriers are back; map the site to a palette.v1 role instead:\n" +
    legacy.join("\n"),
);

const css = readFileSync(join(AGS, "style.css"), "utf8");

// The role set the migration actually relies on. Keeping this explicit means a
// stylesheet cannot quietly fall back to a producer alias (`@foreground`,
// `@accent`) or a role the platform does not define.
const requiredRoles = [
  "on_surface",
  "surface",
  "primary",
  "on_primary",
  "outline_variant",
  "error",
  "on_error",
];

for (const role of requiredRoles) {
  assert.ok(css.includes(`@${role}`), `style.css lost its @${role} role reference`);
}

// No page-background ink on a solid accent: inverted text uses the paired
// on-primary role (never @surface / the old @color_background).
assert.doesNotMatch(
  css,
  /color:\s*@surface\b/,
  "text on a solid accent must use @on_primary, never @surface",
);
