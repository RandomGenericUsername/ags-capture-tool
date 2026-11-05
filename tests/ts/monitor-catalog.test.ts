// ---------------------------------------------------------------------------
// REQ-011 — monitor catalog merge + runtime adapter.
//
// Executed under plain Node: the domain is pure and the adapter takes an
// injected exec function, so the CLI failure/cache/fake-binary paths are real
// tests rather than source greps. The composition root supplies AGS's
// `execAsync`; nothing here needs GTK.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import {
  catalogFromPayload,
  compareMonitors,
  mergeMonitors,
  parseCatalogPayload,
} from "../../domain/monitor-catalog.ts"
import type { MonitorDescriptor } from "../../domain/monitor-registry.ts"
import { MONITOR_CATALOG_ARGV, runtimeMonitorCatalog } from "../../adapters/runtime-monitor-catalog.ts"
import type { CatalogMonitor } from "../../ports/monitor-catalog.ts"

const runFile = promisify(execFile)

function gdk(
  connector: string,
  geometry: MonitorDescriptor["geometry"] = { x: 0, y: 0, width: 1920, height: 1080 },
): MonitorDescriptor {
  return { connector, model: connector, manufacturer: "", geometry }
}

function catalog(
  connector: string,
  over: Partial<CatalogMonitor> = {},
): CatalogMonitor {
  return {
    connector,
    label: connector,
    description: "",
    make: "",
    model: "",
    serial: "",
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
    scale: 1,
    transform: 0,
    focused: false,
    mirror_of: null,
    ...over,
  }
}

function payload(monitors: unknown[], schemaVersion = 1): string {
  return JSON.stringify({ schema_version: schemaVersion, source: "hyprland", monitors })
}

// ---------------------------------------------------------------------------
// Pure merge rule (§2.4)
// ---------------------------------------------------------------------------

test("compareMonitors orders by x, then y, then connector", () => {
  const ordered = [
    gdk("HDMI-A-1", { x: 1920, y: 0, width: 2560, height: 1440 }),
    gdk("DP-3", { x: 0, y: 1080, width: 1920, height: 1080 }),
    gdk("eDP-1", { x: 0, y: 0, width: 1920, height: 1080 }),
  ].sort(compareMonitors)
  assert.deepEqual(ordered.map((monitor) => monitor.connector), [
    "eDP-1",
    "DP-3",
    "HDMI-A-1",
  ])
})

test("a catalog-only connector is never offered", () => {
  const merged = mergeMonitors(
    [gdk("eDP-1")],
    [catalog("eDP-1", { label: "Laptop panel" }), catalog("DP-9", { label: "Ghost" })],
    "eDP-1",
  )
  assert.deepEqual(merged.map((monitor) => monitor.connector), ["eDP-1"])
})

test("a GDK-only monitor still appears with a connector + geometry fallback", () => {
  const merged = mergeMonitors([gdk("eDP-1", { x: 0, y: 0, width: 1366, height: 768 })], [], "eDP-1")
  assert.deepEqual(merged, [
    {
      connector: "eDP-1",
      label: "eDP-1",
      detail: "1366×768 · focused",
      geometry: { x: 0, y: 0, width: 1366, height: 768 },
      focused: true,
    },
  ])
})

test("the focus port is authoritative and the catalog focus is only a fallback", () => {
  const list = [
    gdk("eDP-1"),
    gdk("HDMI-A-1", { x: 1920, y: 0, width: 2560, height: 1440 }),
  ]
  const fromPort = mergeMonitors(
    list,
    [catalog("eDP-1", { focused: true }), catalog("HDMI-A-1", { focused: false })],
    "HDMI-A-1",
  )
  assert.deepEqual(fromPort.map((monitor) => [monitor.connector, monitor.focused]), [
    ["eDP-1", false],
    ["HDMI-A-1", true],
  ])

  // No focus answer: the catalog's `focused` is the documented fallback.
  const fallback = mergeMonitors(
    list,
    [catalog("eDP-1", { focused: false }), catalog("HDMI-A-1", { focused: true })],
    null,
  )
  assert.deepEqual(fallback.map((monitor) => [monitor.connector, monitor.focused]), [
    ["eDP-1", false],
    ["HDMI-A-1", true],
  ])
})

test("row label is the connector; the detail carries the human label and focus", () => {
  const merged = mergeMonitors(
    [gdk("eDP-1"), gdk("HDMI-A-1", { x: 1920, y: 0, width: 2560, height: 1440 })],
    [
      catalog("eDP-1", {
        label: "BOE 0x0BCA",
        description: "BOE 0x0BCA",
        geometry: { x: 0, y: 0, width: 1920, height: 1080 },
      }),
      catalog("HDMI-A-1", {
        label: "Dell U2720Q",
        description: "Dell U2720Q",
        geometry: { x: 1920, y: 0, width: 2560, height: 1440 },
      }),
    ],
    "eDP-1",
  )
  assert.deepEqual(merged, [
    {
      connector: "eDP-1",
      label: "eDP-1",
      detail: "1920×1080 · BOE 0x0BCA · focused",
      geometry: { x: 0, y: 0, width: 1920, height: 1080 },
      focused: true,
    },
    {
      connector: "HDMI-A-1",
      label: "HDMI-A-1",
      detail: "2560×1440 · Dell U2720Q",
      geometry: { x: 1920, y: 0, width: 2560, height: 1440 },
      focused: false,
    },
  ])
})

test("mergeMonitors sorts with the shared comparator and never mutates input", () => {
  const targetable = [
    gdk("HDMI-A-1", { x: 1920, y: 0, width: 2560, height: 1440 }),
    gdk("eDP-1"),
  ]
  const catalogRows = [catalog("eDP-1"), catalog("HDMI-A-1")]
  const merged = mergeMonitors(targetable, catalogRows, "eDP-1")
  assert.deepEqual(merged.map((monitor) => monitor.connector), ["eDP-1", "HDMI-A-1"])
  assert.deepEqual(targetable.map((monitor) => monitor.connector), ["HDMI-A-1", "eDP-1"])
  assert.deepEqual(catalogRows.map((monitor) => monitor.connector), ["eDP-1", "HDMI-A-1"])
})

test("a GDK monitor with no connector is not targetable", () => {
  const unnamed: MonitorDescriptor = {
    connector: null,
    model: "panel",
    manufacturer: "vendor",
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
  }
  assert.deepEqual(mergeMonitors([unnamed, gdk("eDP-1")], [], null).map((m) => m.connector), [
    "eDP-1",
  ])
})

// ---------------------------------------------------------------------------
// Payload validation / mapping
// ---------------------------------------------------------------------------

test("parseCatalogPayload maps the schema_version 1 shape", () => {
  const monitors = parseCatalogPayload(
    payload([
      {
        connector: "eDP-1",
        label: "BOE 0x0BCA",
        description: "BOE 0x0BCA",
        make: "BOE",
        model: "0x0BCA",
        serial: "",
        geometry: { x: 0, y: 0, width: 1920, height: 1080 },
        scale: 1,
        transform: 0,
        focused: true,
        mirror_of: null,
      },
    ]),
  )
  assert.equal(monitors.length, 1)
  assert.equal(monitors[0].connector, "eDP-1")
  assert.equal(monitors[0].label, "BOE 0x0BCA")
  assert.deepEqual(monitors[0].geometry, { x: 0, y: 0, width: 1920, height: 1080 })
  assert.equal(monitors[0].focused, true)
})

test("invalid JSON, a wrong schema_version and a missing monitors array yield []", () => {
  assert.deepEqual(parseCatalogPayload("not json"), [])
  assert.deepEqual(parseCatalogPayload(payload([], 2)), [])
  assert.deepEqual(parseCatalogPayload(JSON.stringify({ schema_version: 1 })), [])
  assert.deepEqual(catalogFromPayload({ schema_version: 1, monitors: [] }), [])
})

test("malformed catalog rows are dropped instead of reaching the UI", () => {
  const monitors = parseCatalogPayload(
    payload([
      { connector: "" },
      { connector: 42 },
      { connector: "eDP-1", geometry: { x: 0, y: 0, width: 1920, height: 1080 } },
    ]),
  )
  assert.deepEqual(monitors.map((monitor) => monitor.connector), ["eDP-1"])
  assert.equal(monitors[0].label, "eDP-1", "missing label falls back to connector")
})

// ---------------------------------------------------------------------------
// Adapter: cache, failure fallback, and a fake `dotfiles-runtime` on PATH
// ---------------------------------------------------------------------------

test("the adapter caches for 2 s and re-reads after the window", async () => {
  let now = 1_000
  let calls = 0
  const adapter = runtimeMonitorCatalog(async () => {
    calls += 1
    return payload([{ connector: "eDP-1", geometry: { x: 0, y: 0, width: 1920, height: 1080 } }])
  }, () => now)

  assert.equal((await adapter.list()).length, 1)
  assert.equal(calls, 1)
  now += 1_999
  await adapter.list()
  assert.equal(calls, 1, "inside the 2 s window the cached value is used")
  now += 1
  await adapter.list()
  assert.equal(calls, 2, "at 2 s the adapter re-reads")
})

test("the adapter never rejects: a missing/broken CLI answers [] and caches it", async () => {
  let calls = 0
  let now = 0
  const adapter = runtimeMonitorCatalog(async () => {
    calls += 1
    throw new Error("spawn dotfiles-runtime ENOENT")
  }, () => now)

  assert.deepEqual(await adapter.list(), [])
  assert.deepEqual(await adapter.list(), [])
  assert.equal(calls, 1, "a failure is cached for 2 s, so the UI does not spam the CLI")
  now += 2_000
  assert.deepEqual(await adapter.list(), [])
  assert.equal(calls, 2)
})

test("the composition root wires the catalog port and supplies AGS execAsync", () => {
  const app = readFileSync(fileURLToPath(new URL("../../app.tsx", import.meta.url)), "utf8")
  const ports = readFileSync(
    fileURLToPath(new URL("../../ports/capture-ports.ts", import.meta.url)),
    "utf8",
  )
  assert.match(ports, /monitorCatalog: MonitorCatalog/)
  assert.match(app, /monitorCatalog: runtimeMonitorCatalog\(/)
  assert.match(app, /execAsync\(\[\.\.\.argv\]\)/)
})

test("a fake dotfiles-runtime on PATH changes the row label without a code change", async () => {
  const dir = mkdtempSync(join(tmpdir(), "capture-monitor-catalog-"))
  const script = join(dir, "dotfiles-runtime")
  try {
    writeFileSync(
      script,
      `#!/bin/sh
if [ "$1" = "monitors" ] && [ "$2" = "list" ] && [ "$3" = "--format" ] && [ "$4" = "json" ]; then
  cat <<'JSON'
{"schema_version":1,"source":"hyprland","monitors":[
  {"connector":"eDP-1","label":"Fake Panel 9000","description":"Fake Panel 9000","make":"Fake","model":"9000","serial":"","geometry":{"x":0,"y":0,"width":1920,"height":1080},"scale":1,"transform":0,"focused":true,"mirror_of":null}
]}
JSON
  exit 0
fi
echo "unexpected argv: $*" >&2
exit 2
`,
    )
    chmodSync(script, 0o755)

    let seenArgv: readonly string[] = []
    const adapter = runtimeMonitorCatalog(async (argv) => {
      seenArgv = argv
      const { stdout } = await runFile(argv[0], argv.slice(1), {
        env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}` },
      })
      return stdout
    })

    const rows = await adapter.list()
    assert.deepEqual(seenArgv, [...MONITOR_CATALOG_ARGV])
    assert.equal(rows[0].label, "Fake Panel 9000", "the label comes from the CLI response")

    const merged = mergeMonitors([gdk("eDP-1")], rows, "eDP-1")
    assert.equal(merged[0].label, "eDP-1", "the row's primary text stays the connector")
    assert.match(merged[0].detail, /Fake Panel 9000/, "the catalog label reaches the row detail")
    assert.match(merged[0].detail, /focused/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
