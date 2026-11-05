// ---------------------------------------------------------------------------
// REQ-013: the mockup parity harness.
//
// This is the anti-drift gate from EPIC-002 design.md §4. The mockup's
// `<script type="application/json" id="design-contract">` block is the
// normative vocabulary; `ui/shared/field-defs.ts` and
// `ui/shared/settings-defs.ts` are the implementation's pure mirror. If either
// side changes alone, this suite fails.
//
// Node built-ins only: no `ags/*`, no `gi://*`, no GTK. `make test` runs every
// `tests/ts/*.test.ts` through `node --test`.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  BAR_FIELD_PRESENTATIONS,
  DEFAULT_BAR_FIELDS,
  DESIGN_CONTRACT_VERSION,
  MONITOR_FIELD,
  RECORDING_DEFAULTS,
  RECORDING_FIELDS,
  RECORDING_FIELD_ORDER,
  SCREENSHOT_DEFAULTS,
  SCREENSHOT_FIELDS,
  SCREENSHOT_FIELD_ORDER,
  type FieldDef,
  type FieldOptionDef,
  type MonitorFieldDef,
  type RecordingFieldDefs,
  type ScreenshotFieldDefs,
} from "../../ui/shared/field-defs.ts"
import {
  SETTINGS_RECORDING_CONTROL_OPTIONS,
  settingsGroups,
} from "../../ui/shared/settings-defs.ts"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

function read(...parts: string[]): string {
  return readFileSync(fileURLToPath(new URL(parts.join("/"), `file://${ROOT}/`)), "utf8")
}

/** Strip comments so source assertions cannot be satisfied by prose alone. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
}

const MOCKUP_PATH = [
  "tickets",
  "EPIC-002-monitor-catalog-dropdowns",
  "mockups",
  "capture-tool-dropdowns.html",
] as const
const MOCKUP_FILE = fileURLToPath(
  new URL(MOCKUP_PATH.join("/"), `file://${ROOT}/`),
)
const MOCKUP = readFileSync(MOCKUP_FILE, "utf8")
const MOCKUP_BYTES = readFileSync(MOCKUP_FILE)
const TICKET = read("tickets", "REQ-013-mockup-parity-harness", "ticket.md")
const CSS = read("style.css")
const DROPDOWN = code(read("ui", "shared", "dropdown.ts"))

interface ContractPlainField {
  key: string
  desc: string
  options: string[][]
}

interface ContractField {
  key?: string
  desc?: string
  source?: string
  options?: string[][]
  variants?: Record<"std" | "gif", ContractPlainField>
}

interface ContractLane {
  fields: string[]
  defaults: Record<string, string>
  defs: Record<string, ContractField>
}

interface ContractMonitor {
  id: string
  label: string
  detail: string
  focused: boolean
}

interface Contract {
  version: number
  lanes: {
    shot: ContractLane
    rec: ContractLane
  }
  monitors: ContractMonitor[]
  settings: {
    groups: Array<{ title: string; rows: string[] }>
    recordingControls: string[][]
    barFields: {
      default: string
      options: string[][]
    }
  }
}

function designContract(): Contract {
  const match =
    /<script type="application\/json" id="design-contract">([\s\S]*?)<\/script>/.exec(
      MOCKUP,
    )
  assert.ok(match, "the mockup design-contract block is missing")
  return JSON.parse(match[1]) as Contract
}

function optionDefs(tuples: string[][]): FieldOptionDef[] {
  return tuples.map(([value, label, description, icon]) => ({
    value,
    label,
    description,
    icon,
  }))
}

function assertPlainField(label: string, actual: FieldDef, expected: ContractField): void {
  assert.equal(actual.key, expected.key, `${label} key drifted`)
  assert.equal(actual.description, expected.desc, `${label} description drifted`)
  assert.deepEqual(
    actual.options,
    optionDefs(expected.options ?? []),
    `${label} options drifted`,
  )
}

function assertMonitorField(actual: MonitorFieldDef, expected: ContractField): void {
  assert.equal(actual.key, expected.key, "monitor key drifted")
  assert.equal(actual.description, expected.desc, "monitor description drifted")
  assert.equal(actual.source, expected.source, "monitor source drifted")
}

function recordedMockupHash(): string {
  const match = /^mockup-sha256:\s*([0-9a-fA-F]{64})\s*$/m.exec(TICKET)
  assert.ok(match, "tickets/REQ-013-mockup-parity-harness/ticket.md has no mockup-sha256")
  return match[1].toLowerCase()
}

test("the contract version matches DESIGN_CONTRACT_VERSION", () => {
  assert.equal(DESIGN_CONTRACT_VERSION, designContract().version)
})

test("the screenshot lane matches the mockup contract exactly", () => {
  const lane = designContract().lanes.shot

  assert.deepEqual([...SCREENSHOT_FIELD_ORDER], lane.fields)
  assert.deepEqual(Object.keys(SCREENSHOT_FIELDS), lane.fields)
  assert.deepEqual(Object.keys(SCREENSHOT_DEFAULTS), Object.keys(lane.defaults))
  assert.deepEqual(SCREENSHOT_DEFAULTS, lane.defaults)

  for (const field of SCREENSHOT_FIELD_ORDER) {
    const expected = lane.defs[field]
    const actual = SCREENSHOT_FIELDS[field as keyof ScreenshotFieldDefs]
    assert.ok(expected, `contract has no shot.${field} definition`)
    assert.ok(actual, `field-defs has no shot.${field} definition`)

    if (field === "monitor") {
      assertMonitorField(actual as MonitorFieldDef, expected)
      continue
    }
    assertPlainField(`shot.${field}`, actual as FieldDef, expected)
  }
})

test("the recording lane matches the mockup contract exactly, including both FPS variants", () => {
  const lane = designContract().lanes.rec

  assert.deepEqual([...RECORDING_FIELD_ORDER], lane.fields)
  assert.deepEqual(Object.keys(RECORDING_FIELDS), lane.fields)
  assert.deepEqual(Object.keys(RECORDING_DEFAULTS), Object.keys(lane.defaults))
  assert.deepEqual(RECORDING_DEFAULTS, lane.defaults)

  for (const field of RECORDING_FIELD_ORDER) {
    const expected = lane.defs[field]
    const actual = RECORDING_FIELDS[field as keyof RecordingFieldDefs]
    assert.ok(expected, `contract has no rec.${field} definition`)
    assert.ok(actual, `field-defs has no rec.${field} definition`)

    if (field === "fps") {
      const variants = (actual as RecordingFieldDefs["fps"]).variants
      const expectedVariants = expected.variants
      assert.ok(expectedVariants, "contract has no rec.fps variants")
      assert.deepEqual(Object.keys(variants), ["std", "gif"])
      assert.deepEqual(Object.keys(expectedVariants), ["std", "gif"])
      assertPlainField("rec.fps.std", variants.std, expectedVariants.std)
      assertPlainField("rec.fps.gif", variants.gif, expectedVariants.gif)
      continue
    }
    if (field === "monitor") {
      assertMonitorField(actual as MonitorFieldDef, expected)
      continue
    }
    assertPlainField(`rec.${field}`, actual as FieldDef, expected)
  }
})

test("the Monitor field is contract-declared as source: monitors", () => {
  const contract = designContract()
  assert.equal(MONITOR_FIELD.source, "monitors")
  assert.equal(contract.lanes.shot.defs.monitor.source, "monitors")
  assert.equal(contract.lanes.rec.defs.monitor.source, "monitors")

  // The mockup's monitor rows are the shape the dynamic dropdown consumes:
  // id, label, detail, focused. The real connected list is runtime data.
  assert.ok(contract.monitors.length > 0, "contract declares no monitors")
  for (const monitor of contract.monitors) {
    assert.equal(typeof monitor.id, "string", "monitor.id must be a string")
    assert.equal(typeof monitor.label, "string", "monitor.label must be a string")
    assert.equal(typeof monitor.detail, "string", "monitor.detail must be a string")
    assert.equal(typeof monitor.focused, "boolean", "monitor.focused must be a boolean")
  }
})

test("Bar fields match the contract's compact | detailed setting", () => {
  const barFields = designContract().settings.barFields
  assert.equal(DEFAULT_BAR_FIELDS, barFields.default)
  assert.deepEqual(
    BAR_FIELD_PRESENTATIONS.map((option) => [option.label, option.value]),
    barFields.options,
  )
})

test("settingsGroups({ barFields: true }) matches the contract group/row order", () => {
  const expected = designContract().settings.groups
  const actual = settingsGroups({ barFields: true }).map((group) => ({
    title: group.title,
    rows: [...group.rows],
  }))
  assert.deepEqual(actual, expected)
})

test("the recording-controls segmented options match the contract", () => {
  assert.deepEqual(
    SETTINGS_RECORDING_CONTROL_OPTIONS.map((option) => [option.label, option.value]),
    designContract().settings.recordingControls,
  )
})

test("both presentations consume the same field-defs vocabulary", () => {
  // One handle, two renderers. The detailed inline path is not a second
  // option table: it walks `currentOptions: readonly FieldOptionDef[]`.
  assert.match(
    DROPDOWN,
    /import type \{ BarFieldPresentation, FieldOptionDef \} from "\.\/field-defs"/,
  )
  assert.match(DROPDOWN, /options: readonly FieldOptionDef\[\]/)
  assert.match(DROPDOWN, /setOptions\(options: readonly FieldOptionDef\[\]\): void \{/)
  assert.match(DROPDOWN, /setPresentation: \(presentation: BarFieldPresentation\) => void/)
  assert.match(
    DROPDOWN,
    /function setPresentation\(presentation: BarFieldPresentation\): void \{/,
  )
  assert.match(DROPDOWN, /inline-field/)
  assert.match(DROPDOWN, /inline-key/)
  assert.match(DROPDOWN, /inline-group/)
  assert.match(DROPDOWN, /inline-pill/)
  assert.match(
    DROPDOWN,
    /function rebuildPills\(\): void \{[\s\S]*?for \(const option of currentOptions\)/,
  )
  assert.equal(
    (DROPDOWN.match(/for \(const option of currentOptions\)/g) ?? []).length,
    2,
    "the popover rows and the inline pills must both iterate currentOptions",
  )

  // The primitive never imports a lane table or hard-codes contract labels.
  assert.doesNotMatch(DROPDOWN, /SCREENSHOT_FIELDS|RECORDING_FIELDS/)
  assert.doesNotMatch(DROPDOWN, /label: "(Region|Screen|Window|Compact|Detailed)"/)
})

test("style.css defines the field and inline presentation classes", () => {
  for (const className of [
    "field",
    "field-trigger",
    "field-key",
    "field-value",
    "field-lead",
    "field-chevron",
    "field-open",
    "field-popover",
    "field-pop-header",
    "field-pop-title",
    "field-pop-desc",
    "field-list",
    "field-option",
    "field-option-icon",
    "field-option-text",
    "field-option-label",
    "field-option-desc",
    "field-radio",
    "field-selected",
    "field-recording",
    "field-popover-recording",
    "field-custom-editor",
    "field-custom-spin",
    "field-custom-unit",
    "field-custom-set",
    "field-custom-hint",
    "field-inline-editor",
    "inline-field",
    "inline-key",
    "inline-group",
    "inline-pill",
  ]) {
    assert.match(CSS, new RegExp(`\\.${className}\\b`), `style.css is missing .${className}`)
  }
})

test("style.css contains no literal hex colours", () => {
  // CSS ID selectors such as `window#capture-window` are not colour matches:
  // `#capture` has only two leading hex characters before `p`.
  assert.doesNotMatch(CSS, /#[0-9a-fA-F]{3,8}\b/)
})

test("the mockup file matches the ticket's recorded SHA-256", () => {
  const actual = createHash("sha256").update(MOCKUP_BYTES).digest("hex")
  assert.equal(actual, recordedMockupHash(), "the mockup changed without the ticket hash")
})
