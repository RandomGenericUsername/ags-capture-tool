// ---------------------------------------------------------------------------
// REQ-014: compact/detailed bar field presentation.
//
// GTK cannot be constructed under `node --test`, so the presentation switch is
// pinned at two levels:
//   * the pure contract (`domain/settings.ts`, `field-defs.ts`,
//     `settings-defs.ts`) against the mockup's `settings.barFields` block;
//   * source assertions on the one dropdown builder (both presentations consume
//     the same `FieldOptionDef[]`) and on the window switch (close popovers,
//     preserve `UiState`, one `syncWindowSize()`).
//
// The duration editor has its own suite (`custom-duration-spin.test.ts`); here
// we only pin that the detailed inline editor shares the commit/restore path
// with the compact popover footer.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  BAR_FIELD_PRESENTATIONS,
  DEFAULT_BAR_FIELDS,
  RECORDING_FIELDS,
  SCREENSHOT_FIELDS,
} from "../../ui/shared/field-defs.ts"
import {
  CONFIG_BAR_FIELDS,
  DEFAULT_SETTINGS,
  mergeSettings,
} from "../../domain/settings.ts"
import {
  SETTINGS_GROUP_TITLES,
  SETTINGS_ROW_NAMES,
  settingsGroups,
} from "../../ui/shared/settings-defs.ts"

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

const MOCKUP = read(
  "tickets",
  "EPIC-002-monitor-catalog-dropdowns",
  "mockups",
  "capture-tool-dropdowns.html",
)
const WINDOW = code(read("ui", "classic", "ClassicWindow.tsx"))
const SETTINGS = code(read("ui", "classic", "SettingsPage.tsx"))
const DROPDOWN = code(read("ui", "shared", "dropdown.ts"))
const CSS = read("style.css")

interface BarFieldsContract {
  default: string
  options: string[][]
}

function barFieldsContract(): BarFieldsContract {
  const match =
    /<script type="application\/json" id="design-contract">([\s\S]*?)<\/script>/.exec(MOCKUP)
  assert.ok(match, "the mockup design-contract block is missing")
  const parsed = JSON.parse(match[1]) as { settings: { barFields: BarFieldsContract } }
  return parsed.settings.barFields
}

test("bar_fields defaults to compact and missing/corrupt values degrade to compact", () => {
  assert.equal(DEFAULT_SETTINGS.bar_fields, "compact")
  assert.deepEqual(CONFIG_BAR_FIELDS, ["compact", "detailed"])
  assert.equal(mergeSettings(undefined).bar_fields, "compact")
  assert.equal(mergeSettings({}).bar_fields, "compact")

  for (const value of ["compact", "detailed"] as const) {
    assert.equal(mergeSettings({ bar_fields: value }).bar_fields, value)
  }

  // The merge is membership-based, never coercing strings/case/objects.
  for (const bad of [null, "Compact", "DETAILED", "expanded", 1, true, {}, []]) {
    assert.equal(
      mergeSettings({ bar_fields: bad }).bar_fields,
      "compact",
      `expected compact for ${String(bad)}`,
    )
  }
})

test("field-defs mirrors the mockup settings.barFields contract exactly", () => {
  const contract = barFieldsContract()
  assert.equal(DEFAULT_BAR_FIELDS, contract.default)
  assert.deepEqual(
    BAR_FIELD_PRESENTATIONS.map((option) => [option.label, option.value]),
    contract.options,
  )
})

test("settings-defs puts Bar fields in Behaviour through settingsGroups({ barFields: true })", () => {
  const behaviour = settingsGroups({ barFields: true }).find(
    (group) => group.title === SETTINGS_GROUP_TITLES.behaviour,
  )
  assert.ok(behaviour, "the Behaviour group is missing")
  assert.deepEqual(behaviour.rows, [
    SETTINGS_ROW_NAMES.showNotifications,
    SETTINGS_ROW_NAMES.compactBarIndicator,
    SETTINGS_ROW_NAMES.barFields,
  ])
  assert.equal(SETTINGS_ROW_NAMES.barFields, "Bar fields")

  // Without the flag the REQ-012 table is unchanged (the row is opt-in).
  const plain = settingsGroups().find((group) => group.title === SETTINGS_GROUP_TITLES.behaviour)
  assert.deepEqual(plain?.rows, [
    SETTINGS_ROW_NAMES.showNotifications,
    SETTINGS_ROW_NAMES.compactBarIndicator,
  ])
})

test("SettingsPage renders Bar fields with BAR_FIELD_PRESENTATIONS and persists immediately", () => {
  assert.match(SETTINGS, /settingsGroups\(\{\s*barFields: true,?\s*\}\)/)
  assert.match(SETTINGS, /SETTINGS_ROW_NAMES\.barFields/)
  assert.match(SETTINGS, /BAR_FIELD_PRESENTATIONS/)
  assert.match(SETTINGS, /settingsConfig\.bar_fields = value/)
  const row = SETTINGS.slice(
    SETTINGS.indexOf("pillRow<ConfigBarFields>"),
    SETTINGS.indexOf("const placementGroup"),
  )
  assert.match(row, /pillRow<ConfigBarFields>/, "Bar fields is the shared segmented row")
  assert.match(row, /rowContext/, "the row uses the immediate-save context")
})

test("the dropdown handle exposes setPresentation and keeps one handle surface", () => {
  assert.match(DROPDOWN, /export interface DropdownFieldHandle/)
  assert.match(DROPDOWN, /setPresentation: \(presentation: BarFieldPresentation\) => void/)
  assert.match(DROPDOWN, /presentation\?: BarFieldPresentation/)
  assert.match(DROPDOWN, /inline-field/)
  assert.match(DROPDOWN, /inline-key/)
  assert.match(DROPDOWN, /inline-group/)
  assert.match(DROPDOWN, /inline-pill/)
  assert.match(DROPDOWN, /function rebuildPills\(\)/)
  // isOpen() is false in detailed; open/close are no-ops there.
  assert.match(
    DROPDOWN,
    /function isOpen\(\): boolean \{\s*return currentPresentation === "compact" && popover\.get_visible\(\)/,
  )
  assert.match(
    DROPDOWN,
    /function close\(\): void \{\s*if \(currentPresentation === "detailed" \|\| !isOpen\(\)\) return/,
  )
  assert.match(
    DROPDOWN,
    /function open\(\): void \{\s*if \(currentPresentation === "detailed"\) return/,
  )
})

test("both presentations consume the same FieldOptionDef[] (no duplicate option table)", () => {
  // The primitive never imports a lane definition and never hard-codes a
  // label; it only walks `currentOptions`, once for the popover and once for
  // the inline pills.
  assert.doesNotMatch(DROPDOWN, /SCREENSHOT_FIELDS|RECORDING_FIELDS/)
  assert.doesNotMatch(DROPDOWN, /label: "(Region|Screen|Window|Compact|Detailed)"/)
  assert.equal(
    (DROPDOWN.match(/for \(const option of currentOptions\)/g) ?? []).length,
    2,
    "the popover rows and the inline pills must both iterate currentOptions",
  )
  assert.match(
    DROPDOWN,
    /function rebuildPills\(\): void \{[\s\S]*?for \(const option of currentOptions\)[\s\S]*?new Gtk\.Button\(\{ label: option\.label \}\)/,
  )
  // setOptions refreshes both renderers from the one array.
  assert.match(
    DROPDOWN,
    /setOptions\(options: readonly FieldOptionDef\[\]\): void \{\s*currentOptions = options\s*rebuildRows\(\)/,
  )
})

test("both lanes pass the presentation into the shared handles and keep field order", () => {
  // 15 field builders (6 screenshot + 9 recording) all receive the setting.
  assert.equal(
    (WINDOW.match(/presentation: barFields,/g) ?? []).length,
    15,
    "every screenshot/recording field must receive the presentation",
  )
  // The lane pages still own only the roots and order.
  const SCREENSHOT_PAGE = code(read("ui", "classic", "ScreenshotPage.tsx"))
  const RECORDING_PAGE = code(read("ui", "classic", "RecordingPage.tsx"))
  assert.match(
    SCREENSHOT_PAGE,
    /fields\.target\.root[\s\S]*fields\.monitor\.root[\s\S]*fields\.delay\.root[\s\S]*fields\.format\.root[\s\S]*fields\.output\.root[\s\S]*fields\.cursor\.root/,
  )
  assert.match(
    RECORDING_PAGE,
    /fields\.target\.root[\s\S]*fields\.monitor\.root[\s\S]*fields\.fps\.root[\s\S]*fields\.format\.root[\s\S]*fields\.quality\.root[\s\S]*fields\.audio\.root[\s\S]*fields\.size\.root[\s\S]*fields\.duration\.root[\s\S]*fields\.cursor\.root/,
  )
  // Both lanes still cover every contract option; detailed does not filter.
  assert.ok(SCREENSHOT_FIELDS.target.options.length === 3)
  assert.ok(RECORDING_FIELDS.duration.options.length === 5)
})

test("switching presentation closes popovers, preserves UiState, and does not commit", () => {
  const apply = WINDOW.slice(
    WINDOW.indexOf("function applyBarFields"),
    WINDOW.indexOf("function refreshMonitorFields"),
  )
  assert.match(apply, /if \(presentation === barFields\) return false/)
  assert.match(apply, /closeAllFields\(\)/)
  assert.match(apply, /for \(const field of allFields\(\)\) field\.setPresentation\(presentation\)/)
  assert.doesNotMatch(apply, /uiStateStore\.(save|load)/, "the switch must not touch UiState")
  assert.doesNotMatch(apply, /runCommit|commitCurrentMode|launcher\.launch/, "the switch never commits")

  const settingsChanged = WINDOW.slice(
    WINDOW.indexOf("function settingsChanged"),
    WINDOW.indexOf("// The S4 row is the SAME shared cluster"),
  )
  assert.match(settingsChanged, /if \(switched\) applyBarFields\(next\.bar_fields\)/)
  assert.match(settingsChanged, /applyPlacement\(false\)/)
})

test("exactly one syncWindowSize() runs per presentation switch", () => {
  const settingsChanged = WINDOW.slice(
    WINDOW.indexOf("function settingsChanged"),
    WINDOW.indexOf("// The S4 row is the SAME shared cluster"),
  )
  assert.equal(
    (settingsChanged.match(/syncWindowSize\(\)/g) ?? []).length,
    1,
    "one resize per switch, none for unrelated saves",
  )
  assert.match(settingsChanged, /if \(switched \|\| placementChanged\) syncWindowSize\(\)/)
  // The in-place switch itself must not resize; the caller owns the one call.
  const apply = WINDOW.slice(
    WINDOW.indexOf("function applyBarFields"),
    WINDOW.indexOf("function refreshMonitorFields"),
  )
  assert.doesNotMatch(apply, /syncWindowSize/)
  // A focused detailed editor defers Enter/Esc before the window acts.
  const onKey = WINDOW.slice(WINDOW.indexOf("function onKey"), WINDOW.indexOf("function applyStateToUi"))
  assert.match(onKey, /field\.isEditing\?\.\(\) === true/)
  assert.match(onKey, /return false/)
})

test("duration keeps the compact footer editor and adds the detailed inline editor", () => {
  const duration = DROPDOWN.slice(DROPDOWN.indexOf("export function durationField"))
  // Compact: the original popover footer.
  assert.match(duration, /editor\.add_css_class\("field-custom-editor"\)/)
  assert.match(duration, /controls\??\.setValue\(`\$\{seconds\}s`, "Custom"\)/)
  assert.match(duration, /handle\.close\(\)/)
  // Detailed: an inline editor next to the group, sharing commit/restore.
  assert.match(duration, /inlineEditor\.add_css_class\("field-inline-editor"\)|add_css_class\("field-inline-editor"\)/)
  assert.match(duration, /handle\.setValue\(`\$\{seconds\}s`, "Custom"\)/)
  assert.match(duration, /function commitSeconds\(raw: number\)/)
  assert.match(duration, /function restoreSeconds\(\)/)
  assert.match(duration, /function inlineEditorKey\(keyval: number\)/)
  assert.match(duration, /function beginInlineCustom\(\)/)
  assert.match(
    duration,
    /onActivate: \(value\) => \{\s*if \(value !== "Custom"\) return false\s*if \(detailed\) \{\s*beginInlineCustom\(\)/,
    "detailed Custom must keep the previous trigger value and open the editor",
  )
  assert.match(
    duration,
    /function beginInlineCustom\(\): void \{\s*previousValue = handle\.getValue\(\)[\s\S]*?handle\.setValue\(handle\.getValue\(\), "Custom"\)/,
    "the snapshot must happen before the Custom row is selected",
  )
  assert.match(
    DROPDOWN,
    /function chooseInline\(value: string\): void \{[\s\S]*?config\.footer\?\.onActivate\?\.\(value\)/,
    "the inline pills use the same footer activation hook as the popover rows",
  )
  assert.match(
    DROPDOWN,
    /function setPresentation\(presentation: BarFieldPresentation\): void \{[\s\S]*?if \(presentation === "detailed" && popover\.get_visible\(\)\) popover\.popdown\(\)/,
    "switching to detailed closes an open popover before flipping the renderer",
  )
  assert.match(duration, /handle\.isEditing = \(\) => detailed && pending && inlineEditorFocused\(\)/)
  // Both editors feed the same `onCustom` handler, so state is identical.
  assert.match(duration, /config\.onCustom\(seconds\)/)
  // Compact still has no bar resize; the detailed bar is allowed to grow.
  assert.doesNotMatch(duration, /syncWindowSize/)
})

test("style.css defines the inline presentation with palette tokens only", () => {
  for (const className of [
    "inline-field",
    "inline-key",
    "inline-group",
    "inline-pill",
    "field-inline-editor",
  ]) {
    assert.match(CSS, new RegExp(`\\.${className}\\b`), `missing .${className}`)
  }
  const start = CSS.indexOf("REQ-014 detailed presentation")
  const end = CSS.indexOf("Structural recording red on the bar plate")
  assert.ok(start > -1 && end > start, "the inline field CSS block is missing")
  const inlineCss = CSS.slice(start, end)
  assert.doesNotMatch(inlineCss, /#[0-9a-fA-F]{3,8}\b/, "inline CSS must not use literal colours")
})
