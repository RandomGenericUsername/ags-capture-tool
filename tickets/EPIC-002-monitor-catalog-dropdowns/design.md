# EPIC-002 — Shared monitor catalog + capture dropdown UI

**Status:** implemented and released — EPIC-002 closed 2026-11-04; runtime `v0.6.0`
and capture `v0.4.0` tagged and pinned in `dotfiles-v3`.
**Authority:** this plan + the normative mockup
[`capture-tool-dropdowns.html`](./capture-tool-dropdowns.html) + the
`design-contract` JSON block inside that mockup.
**Owner/orchestrator:** the planning agent. Implementation agents execute one
child ticket at a time and stop at the ticket boundary.
**Mode:** the session that produced this plan is in Plan mode. No product file
has been changed. When the user switches agents, the orchestrator creates the
tickets/worktrees listed here and copies the mockup into the capture ticket.

> **Current reference:** only
> `tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html`
> is current. The older
> `tickets/EPIC-001-capture-bar-redesign/mockups/capture-bar-mockups.html` and
> `tickets/EPIC-001-capture-bar-redesign/design.md` are **historical v0.2.x
> records** and still contain `Sys`, `Med`, `bar.recording_hud` and
> `hidden`. They are not implementation references. `OPS-008` adds the
> historical banner and fixes stale code comments; it does not rewrite the
> historical evidence.

---

## 0. Baseline validation (do this first)

The release note supplied by the user was checked against the actual repos on
2026-11-04:

| Repo | Release note | Observed HEAD / tag | Match? | Evidence |
|---|---|---|---|---|
| `ags-platform` | `v0.5.0` | `a6c8dd3` = `v0.5.0` | yes | `git log --oneline --decorate -1` |
| `ags-bar` | `v0.3.0` | `9edbae9` = `v0.3.0` | yes | `git log --oneline --decorate -1` |
| `ags-capture-tool` | `v0.3.0`, `v0.3.1` | `v0.3.0`=`f6e55da`, `v0.3.1`=`50243d8`; main HEAD `8919959` is a docs-only close after `v0.3.1` | yes | `git tag --sort=-creatordate`; `git log --oneline --decorate -5` |
| `dotfiles-provision` | `v0.1.33` | `cfa1e57` = `v0.1.33` | yes | `git log --oneline --decorate -1` |
| `dotfiles-v3` | no tags (composition) | `f84dc204` | yes | `git log --oneline --decorate -1` |
| `dotfiles-runtime` | not in the release note | `v0.5.2`=`81f57c5`; main HEAD `7e6b918` is a docs-only ticket after `v0.5.2` | note | `git tag --sort=-creatordate` |
| `contracts` | not in the release note | `v0.4.0`=`ae3af8b`; the composition tuple still pins `v0.3.0` | note | `git tag --sort=-creatordate`; `dotfiles/provisioning/program-tuple.yaml` |

**Composition pins to use as the working baseline:**

- `dotfiles/provisioning/apps.yaml`: capture `v0.3.1`, bar `v0.3.0`.
- `dotfiles/provisioning/cli-tools.yaml`: runtime `v0.5.2`.
- `dotfiles/provisioning/program-tuple.yaml`: `ags-platform v0.5.0`,
  `contracts v0.3.0`, `dotfiles-assets v0.6.4`.

**What changed in the capture tool since the first Sally mockup (v0.2.4 →
v0.3.1), and must be reflected:**

1. `bar.recording_hud` (`hidden | always | hover`) was replaced by top-level
   `recording_controls` (`top-bar | hover | always`), default `top-bar`.
   Evidence: `domain/settings.ts` (current), `domain/recording-presentation.ts`,
   `CHANGELOG.md` v0.3.0.
2. `hidden` was removed; old configs migrate `hidden → top-bar` in
   `mergeSettings`/`glib-settings-store.ts`.
3. `hover` forces the full inline Pause/Stop controls; the compact popover is
   disabled for `hover`. Evidence: `domain/recording-presentation.ts`
   (`compactAllowed`), `ui/classic/SettingsPage.tsx` compact `toggleRow`
   `isEnabled` callback.
4. The S4 recording controls are now one shared `RecordingCluster` used by the
   top-bar slot and the capture hover/always bar. Evidence:
   `ui/shared/recording-cluster.tsx`, `ui/cluster/ClusterWindow.tsx`,
   `CHANGELOG.md` v0.3.0.
5. S1 option vocabulary itself is unchanged: target/delay/format/output/cursor
   for screenshot; target/fps/format/quality/audio/size/duration/cursor for
   recording. Evidence: `ui/classic/ScreenshotPage.tsx`,
   `ui/classic/RecordingPage.tsx`, `git diff --stat v0.2.4..v0.3.1` (neither
   page changed).

**Therefore the mockup was adapted:** the settings panel now shows
`Recording controls` (`Top bar | On hover | Always visible`) instead of
`Recording HUD`, the compact switch disables in `On hover`, the first-run note
matches the real code defaults, and the `Monitor` cycle chip became a dynamic
dropdown.

---

## 1. Decisions (binding for this epic)

These are the decisions the user approved or delegated. Do not re-litigate them
inside a child ticket.

| # | Decision | Source |
|---|---|---|
| D1 | One dropdown per setting on the bar. Trigger = key + active value + chevron. One popover per field. | User approved Sally's proposal |
| D2 | `Enter` always commits the capture when no popover is open. `Space`/`↓` opens a focused field. An open popover owns arrows/Enter/Esc. | User approved |
| D3 | Remove the Screenshot/Recording "defaults" groups from settings. First run is code constants; after that `capture-ui.json` is authoritative. Keep the legacy JSON fields parseable/deprecated; do not delete them in this pass. | User approved |
| D4 | Cursor stays in `config.json` for now; the bar dropdown is the only UI. Do not migrate it into `capture-ui.json` in this epic. | User approved (recommended option) |
| D5 | Settings keeps segmented controls for Bar position and Recording controls. The dropdown is a bar density adaptation, not a form-wide rule. | User approved |
| D6 | Recording identity moves from selected-pill fill to structural red: active tab, CTA, top tally line, bar border, open-field ring. Fields stay neutral. | User approved |
| D7 | **Monitor discovery is runtime functionality, not a new repo.** `dotfiles-runtime` gains a public `monitors list --format json` command backed by the existing Hyprland monitor source. The capture tool consumes it through a port/adapter, with the GDK topology as the targetable-set authority and fallback. | This plan (user delegated the decision) |
| D8 | The Monitor field is a normal dropdown, never a cycle button. It lists every connected, enabled, non-mirrored output from the catalog. | User instruction |
| D9 | No `contracts` repo bump in this epic. The monitor-list JSON schema lives in `dotfiles-runtime/contracts/schemas/monitors-list.schema.json` with `schema_version: 1`. Promote it to `contracts` only when a third independent consumer needs it. | This plan (scope control) |
| D10 | The mockup's `design-contract` JSON is the machine-readable vocabulary. The implementation's pure `field-defs.ts` and settings layout must match it; the parity test is the gate. | This plan (anti-drift) |
| D11 | The Monitor field is visible when `Target = Screen` and more than one monitor is targetable. With exactly one monitor it stays hidden, matching the current `count > 1` rule. | This plan (keeps current behaviour; change only with user approval) |
| D12 | Full-word labels `System` and `Medium` replace `Sys` and `Med`; the old labels are gone from the UI and tests. | Mockup / Sally proposal |
| D13 | `bar_fields` = `compact | detailed` is in scope. `compact` (default) is the dropdown trigger/popover; `detailed` renders the same `field-defs` as inline option groups. The setting lives in Settings → Behaviour, preserves `UiState`, and calls `syncWindowSize()` once on switch. | User request, 2026-11-04 |

---

## 2. Monitor catalog service — architecture

### 2.1 Why runtime, not a new repo or `ags-platform`

- The runtime already owns host-side monitor discovery for wallpaper:
  `IMonitorSource` (`dotfiles-runtime/src/runtime/ports/monitor_source.py`) and
  `HyprlandMonitorSource`
  (`dotfiles-runtime/src/runtime/adapters/hyprland_monitor_source.py:54-110`).
- The runtime already preserves per-monitor wallpaper config
  (`src/runtime/application/monitors.py:25-87`). A future "set wallpaper by
  monitor" feature is a runtime use case, not a new service.
- A new repo would add a clone, a release tag, a pin, a service unit and a
  second parser for the same `hyprctl monitors -j` payload. That is pure
  duplication.
- `ags-platform` is a TypeScript AGS library; it cannot serve Python/wallpaper
  consumers. The runtime CLI is language-agnostic: AGS apps, shell tools and
  future Python features all read the same command.
- The capture tool's GDK topology remains the authority for which monitors it
  can actually draw an overlay/window on. The catalog enriches labels,
  geometry, focus and ordering; it never invents a targetable monitor.

### 2.2 CLI contract

Command:

```sh
dotfiles-runtime monitors list --format json
```

Plain text is also supported by the existing `cli_output` renderer, but the
machine contract is `--format json`.

Success shape (`schema_version: 1`):

```json
{
  "schema_version": 1,
  "source": "hyprland",
  "monitors": [
    {
      "connector": "eDP-1",
      "label": "eDP-1",
      "description": "BOE 0x0BCA",
      "make": "BOE",
      "model": "0x0BCA",
      "serial": "",
      "geometry": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
      "scale": 1.0,
      "transform": 0,
      "focused": true,
      "mirror_of": null
    }
  ]
}
```

Rules:

- `connector` is the stable id and the exact value the capture backend takes
  for `--monitor`.
- `label` is a short human label: `description` when non-empty, else
  `connector`. The capture UI composes the final row text from `connector`,
  `geometry` and `label`.
- `geometry` is the compositor's logical rectangle; `scale` is the logical
  scale; `transform` is the rotation enum. These are for display and for
  joining to the GDK descriptor, not for re-deriving capture geometry.
- `focused` is the compositor's focused output. Exactly one may be true; none
  is allowed on a transient read.
- Disabled and mirrored outputs are filtered out by default. `mirror_of` is
  present for diagnostics; it is `null` for an independent output.
- Order is deterministic: `geometry.x` ascending, then `geometry.y`, then
  `connector` ascending. This is the canonical order for the dropdown and for
  `Monitor n` numbering.
- Detection failure is not an error: exit `0` with
  `{"schema_version":1,"source":"unavailable","monitors":[]}`. Unexpected
  internal exceptions exit `1` with the CLI's normal error view. No side
  effects, no state writes, no daemon start.
- The command is read-only and safe in headless/CI. It must not require a
  provisioned spine or a writable XDG root.

### 2.3 Reuse in the runtime

- Extend `IMonitorSource` with a richer `list_monitors()` returning descriptors,
  or add a sibling `IMonitorCatalog` port and make `HyprlandMonitorSource`
  implement both. Keep `detect_monitors()` as the name projection used by
  wallpaper, so its existing tests and behavior stay byte-identical.
- The future wallpaper-by-monitor UI reads the same descriptors; it does not
  re-run `hyprctl` or re-parse JSON.
- No `monitors watch` in this epic. The capture tool already has GDK hotplug;
  it re-reads the catalog on popover open and on topology change. A live
  `monitors watch` is a separate follow-up if a third consumer needs push.

### 2.4 Capture-side merge rule

`ui/classic` receives a `MonitorCatalog` port. The dropdown list is built by a
pure function:

```ts
mergeMonitors(
  targetable: MonitorDescriptor[],   // GDK topology — authoritative set
  catalog: CatalogMonitor[],         // runtime CLI — enrichment
  focusedConnector: string | null,   // MonitorFocus port — authoritative focus
): MonitorView[]
```

- Join by `connector`. A catalog entry with no GDK match is ignored: the user
  cannot target a monitor the app has no overlay for.
- A GDK monitor with no catalog entry still appears, labelled by connector +
  geometry. This is the fallback when `dotfiles-runtime` is missing or slow.
- `focused` comes from the existing focus port; the catalog's `focused` is only
  a fallback when the port returns `null`.
- Sort by the catalog order (x, y, connector); if no catalog, sort the GDK
  descriptors by the same comparator.
- Cache the CLI result for 2 seconds. Re-read on every Monitor popover open and
  on a GDK topology change. Never spawn on every keystroke or on every bar
  repaint.

---

## 3. UI design contract

The normative visual reference is
[`capture-tool-dropdowns.html`](./capture-tool-dropdowns.html). Its
`<script type="application/json" id="design-contract">` block is the
machine-readable vocabulary. The mockup's own JS validates itself against that
block and shows a red banner on drift.

### 3.1 Trigger anatomy

- Two-line trigger: 8.5px uppercase key (42% ink) above a 12.5px/600 value
  (full ink). Optional 15px leading glyph for Target and Monitor only. 9px
  chevron on the right; rotates 180° when open.
- Minimum height 40px; padding 4px 9px 4px 10px; no border at rest; hover adds a
  neutral plate; focus adds a 2px accent ring; open uses the lane tint.
- Recording open/selected states use `--rec-accent`; screenshot uses
  `@primary`. No solid-fill selected values.
- The trigger is a field, not a pill. The bar still uses `.bar-divider` between
  logical groups and the existing mode tabs/CTA.

### 3.2 Popover

- One `Gtk.Popover` per field, anchored to its trigger; opens toward the screen
  interior (`TOP` for a bottom bar, `BOTTOM` for a top bar); GTK clamps
  horizontally.
- Header: key + one-line purpose. Body: `Gtk.ListBox` rows with icon, label,
  optional descriptor, and a radio/check marker. Selected row = accent tint +
  accent radio + full-ink label. Hover = neutral. Keyboard focus = accent ring.
- Select-and-close. No Apply button. Click-outside and `Esc` close. `Tab`
  closes and moves to the next field.
- The popover is a separate `Gdk.Popup`; opening/closing must not call
  `syncWindowSize()`.

### 3.3 Field vocabulary and order

Screenshot lane:

```text
back · camera tab · TARGET · [MONITOR] · DELAY · FORMAT · OUTPUT · CURSOR · Capture [Enter]
```

Recording lane:

```text
back · video tab · TARGET · [MONITOR] · FPS/GIF FPS · FORMAT · QUALITY · AUDIO/SIZE · DURATION · CURSOR · Record [Enter]
```

Exact labels/descriptions/values are in the mockup's `design-contract` block and
must be copied verbatim into `ui/shared/field-defs.ts`.

### 3.4 Conditional states

- `Target = Screen` and `monitors.length > 1` → show `MONITOR`. Selecting a row
  calls `selection.selectMonitor(connector)`; no `cycleMonitor`.
- `Format = GIF` → `FPS` becomes `GIF FPS` with `10/15/20/30`; `AUDIO` is
  replaced by `SIZE` in the same slot. The stored std fps/audio values survive
  the round trip. `syncWindowSize()` runs after the format change, not on
  popover open.
- `Duration = Custom` → the duration popover shows an inline seconds editor
  under the `Custom` row. `Enter` sets the value; `Esc` restores the previous
  choice. No inline spin in the bar and no bar resize.
- `Monitor` popover lists connected, enabled, non-mirrored outputs; focused row
  marked; selection updates the pending overlay/badge immediately.

### 3.5 Recording identity

- Red active mode tab, red CTA, 2px red tally line across the bar top edge, red
  bar border, red open-field ring. The field values stay neutral.
- The recording CTA label remains `Record`; screenshot remains `Capture`.
- The existing `recording_controls` / `RecordingCluster` / S4 behavior is out
  of scope; do not change it.

### 3.6 Settings panel

- Header: `Capture settings` + subtitle “The bar remembers every lane choice.
  This panel is for the things the bar has no room to show.” + a
  `Saved as you go` chip.
- Groups:
  - **Files**: Screenshot folder, Recording folder, Filename pattern.
  - **Behaviour**: Show notifications, Compact bar indicator, Bar fields.
  - **Placement**: Bar position, Top offset, Recording controls.
  - **Runtime**: Recorder backend readout, Lane memory readout.
- Deleted: Screenshot defaults (format/output/cursor) and Recording defaults
  (fps/quality/audio/cursor). The duplicate `Include cursor` toggles are gone.
- `Recording controls` is segmented: `Top bar | On hover | Always visible`,
  default `Top bar`. `Compact bar indicator` disables and shows off when
  `On hover` is selected; it restores its stored state when leaving `On hover`.
- `Bar fields` is segmented `Compact | Detailed`, default `Compact`. Compact
  uses the dropdown triggers; Detailed re-renders S1 as inline option groups
  from the same `field-defs` (the old visible-options density). Switching
  preserves the current `UiState`, closes any open popover, and calls
  `syncWindowSize()` once.
- `Top offset` is insensitive/dimmed when `Bar position = Bottom`; it becomes
  active when `Top`.
- Footer: `Esc back · Enter done` + `Back` button. Edits still save immediately.
- Cursor is not in the panel; the bar dropdown is the only control. The
  settings JSON keeps `screenshot.cursor` / `recording.cursor`.

### 3.7 Keyboard

| Context | Enter | Esc | ↑/↓ | Space | Tab |
|---|---|---|---|---|---|
| Bar, nothing focused | Commit | Back one level | — | — | Focus first field |
| Field focused, closed | Commit | Back one level | — | Open field | Next field |
| Popover open | Choose highlighted | Close popover | Move highlight | Choose highlighted | Close + next field |
| Custom duration editor | Set seconds | Cancel + restore | Spin value | — | Move to Set |

Implementation rules:

- `ClassicWindow.onKey` runs in `CAPTURE` phase. It must return `false` for
  Enter/Esc/arrows when any dropdown popover is open, so the popover/listbox
  owns them. Esc closes the popover and must not also walk the bar ladder in the
  same event.
- Enter never opens a field. Space/↓ open. This preserves Enter = commit.
- After a choice, focus returns to the trigger.
- `commitCurrentMode()` closes every open popover synchronously before
  `runCommit`, so no popup surface can outlive the bar or leak into a recording.
- Palette refresh must not close an open popover. Prefer symbolic icons that
  inherit `color`; if generated icons are used in rows, register the open
  popover with the appearance surface or rebuild only its icons.

### 3.8 Detailed presentation (`bar_fields = "detailed"`)

- The same `field-defs` vocabulary renders inline option groups: every option is
  visible, no popover. This is the old density, restored as a user choice.
- Field order and values are identical to compact; only the presentation
  differs.
- The detailed row keeps the mode tabs, dividers, CTA and recording structural
  red. It does not use popovers, so the keyboard contract is the old pill one:
  Enter commits, Esc backs out, Space selects a focused pill (D2: Enter never
  selects). Detailed duration `Custom` reveals an inline seconds editor next to
  the group (the old behavior); the bar may grow. Compact keeps that editor
  inside the duration popover.
- `syncWindowSize()` runs once after the switch. The compact width budgets do
  not apply; detailed is explicitly allowed to be wider and may need horizontal
  clamping on small screens.
- The setting is global (both lanes) and persisted in `config.json` as
  `bar_fields`; default `compact`; missing/corrupt values degrade to `compact`.
- The parity contract includes the setting and the detailed presentation; the
  detailed renderer must use `field-defs`, never a second option table.

---

## 4. Anti-drift harness

The chain is: **mockup contract JSON → pure TS definitions → implementation →
parity test → live evidence.**

### 4.1 Machine-readable contract

The mockup contains:

```html
<script type="application/json" id="design-contract">{ ... }</script>
```

It declares, for both lanes: field order, defaults, each field's key,
description and options (`value`, `label`, `description`, icon), the monitor
list shape, the settings group/row order, the recording-controls values, and
the `barFields` setting (`compact | detailed`, default `compact`).
The mockup's own `validateDesignContract()` compares its JS definitions to this
block and shows a red banner on mismatch.

### 4.2 Pure TS definitions

Create `ui/shared/field-defs.ts` (no `ags/*`, no `gi://*`, no I/O) exporting:

- `DESIGN_CONTRACT_VERSION = 1`
- `SCREENSHOT_FIELD_ORDER`, `RECORDING_FIELD_ORDER`
- `SCREENSHOT_FIELDS`, `RECORDING_FIELDS` with the exact contract labels,
  descriptions and option values. `RECORDING_FIELDS.fps` is the two-variant
  shape from the contract: `{ variants: { std: { key, desc, options }, gif:
  { key, desc, options } } }`.
- `MONITOR_FIELD`
- `RECORDING_CONTROL_OPTIONS`

Create `ui/shared/settings-defs.ts` (pure) exporting the group titles and row
names in order, plus the recording-controls options. `SettingsPage` must use
these constants for titles/order; the parity test compares them to the mockup.

### 4.3 `tests/ts/mockup-parity.test.ts`

The test:

1. Reads the mockup from
   `tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html`.
2. Extracts and parses the `design-contract` JSON.
3. Asserts `DESIGN_CONTRACT_VERSION` matches.
4. Asserts lane field order, defaults, keys, descriptions and every option
   tuple match `field-defs.ts` exactly (deep equality, order included).
5. Asserts the contract's monitor entries have the required `id`/`label`/
   `detail`/`focused` shape and that `MONITOR_FIELD` is declared as
   `source: "monitors"`. The real connected list is runtime data and is covered
   by `REQ-011`'s adapter/merge tests.
6. Asserts `settings-defs.ts` group titles, row names and recording-control
   values match.
7. Asserts every required `.field-*` class exists in `style.css`.
8. Asserts `style.css` contains no literal hex colours
   (`/#[0-9a-fA-F]{3,8}\b/`) outside comments.
9. Asserts the mockup file is byte-identical to the ticket copy recorded in the
   ticket's `mockup-sha256:` field. This catches an agent editing the mockup
   without updating the ticket.

The test is a normal `make test` test; it must not import GTK.

### 4.4 Live visual evidence

Each UI child ticket records screenshots (or a short screen recording) for the
states it changes under `/tmp/opencode/capture-dropdowns/<ticket>/` and copies
the paths into the ticket. Minimum matrix:

| State | Evidence |
|---|---|
| Screenshot lane closed | `shot-closed.png` |
| Screenshot cursor popover open | `shot-cursor-open.png` |
| Recording lane closed | `rec-closed.png` |
| Recording format popover open | `rec-format-open.png` |
| Recording GIF conditional | `rec-gif.png` |
| Recording custom duration editor | `rec-custom.png` |
| Monitor dropdown (two outputs) | `monitor-open.png` |
| Settings panel | `settings.png` |
| Settings `On hover` compact disabled | `settings-hover.png` |
| Palette refresh with a popover open | `palette-open.png` + note |

The ticket must also record the measured lane widths from
`panel.measure(Gtk.Orientation.HORIZONTAL, -1)`:

- Screenshot target: ≤ 700 px.
- Recording target: ≤ 900 px.
- Current baseline: recording S1 ≈ 1506 px
  (`ui/classic/ClassicWindow.tsx` hover-footprint comment). Any regression above
  the ceiling stops the ticket.

---

## 5. Epic and child tickets

**Epic location:** `ags-capture-tool/tickets/EPIC-002-monitor-catalog-dropdowns/`.
**Epic done-when:** all children `done`; parity test green; live evidence
complete; runtime and capture releases tagged; `dotfiles-v3` pins updated and
`make deploy-coverage` green; no open deviation from the mockup.

### Child map

| Child | Title | Repos | Depends on | Blocks |
|---|---|---|---|---|
| `REQ-008` | Shared monitor catalog service | `dotfiles-runtime` (+ capture consumer contract) | — | `REQ-011`, `OPS-007` |
| `REQ-009` | Dropdown primitive + screenshot lane | `ags-capture-tool` | — | `REQ-010`, `REQ-011`, `REQ-012` |
| `REQ-010` | Recording lane dropdowns + conditional states | `ags-capture-tool` | `REQ-009` | `REQ-012`, `OPS-007` |
| `REQ-011` | Dynamic monitor dropdown + remove cycle chip | `ags-capture-tool` | `REQ-008`, `REQ-009` | `REQ-012`, `OPS-007` |
| `REQ-012` | Settings cleanup + persistence | `ags-capture-tool` | `REQ-009`, `REQ-010`, `REQ-011` | `REQ-014`, `OPS-007` |
| `REQ-014` | Compact/detailed bar field presentation setting | `ags-capture-tool` | `REQ-010`, `REQ-011`, `REQ-012` | `REQ-013`, `OPS-007` |
| `REQ-013` | Mockup parity harness | `ags-capture-tool` | `REQ-009`–`REQ-012`, `REQ-014` | `OPS-007` |
| `OPS-008` | Documentation reconciliation | `ags-capture-tool` | `REQ-012` | `OPS-007` |
| `OPS-007` | Release and pins | `dotfiles-runtime`, `ags-capture-tool`, `dotfiles-v3` | all above | — |

The runtime service is also filed in `dotfiles-runtime/tickets/` as
`REQ-009-shared-monitor-catalog` (the next free runtime REQ id). The capture
`REQ-008` ticket is the consumer contract and links to it; the runtime ticket is
the execution record for the service itself.

### Ticket frontmatter requirements

Every child ticket uses the repo template and adds:

```yaml
repos: [ags-capture-tool]          # or [dotfiles-runtime, ags-capture-tool]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
mockup-sha256: <sha256 of the mockup>
depends-on: [REQ-xxx]
blocks: [REQ-xxx]
```

The epic `ticket.md` lists the children with status, and `tickets/INDEX.md` is
updated in the same commit as every status change (repo rule).

---

## 6. Child ticket specifications

### REQ-008 — Shared monitor catalog service

**Repos:** `dotfiles-runtime` (execution), `ags-capture-tool` (consumer
contract only).
**Goal:** one read-only, language-agnostic command that returns the connected
monitor descriptors; the runtime's wallpaper code and the capture tool both
consume it.

**Implementation (runtime):**

- Add a sibling `src/runtime/ports/monitor_catalog.py` with a `MonitorInfo`
  value and `list_monitors()`. Do **not** add an abstract method to
  `IMonitorSource`: its existing implementations and fakes must stay
  byte-compatible. `HyprlandMonitorSource` implements both ports.
- Extend `src/runtime/adapters/hyprland_monitor_source.py` to parse the full
  `hyprctl monitors -j` payload into descriptors. Keep `detect_monitors()`
  returning the sorted active names; existing tests must stay green.
- Add a pure projection/order function in `src/runtime/application/monitors.py`
  (or a new `monitor_catalog.py`) that filters disabled/mirrored outputs and
  sorts by x, y, connector.
- Add `monitors` Typer group + `list` command in `src/runtime/cli/main.py`
  using `_OUTPUT_FORMAT_OPTION` and `CustomView` (same pattern as
  `inspect status`). Plain output is a short one-line-per-monitor summary;
  JSON is the contract.
- Add `contracts/schemas/monitors-list.schema.json` and a test that validates
  the command output against it. The schema is runtime-owned (D9); do not bump
  the `contracts` repo or the program tuple.
- Add tests: active/filtered/sorted, focused flag, scale/transform/geometry,
  disabled/mirror filtering, empty/unavailable -> exit 0 + `source:
  "unavailable"`, invalid JSON/non-zero exit/missing binary, schema validation,
  no state writes.
- Update `CHANGELOG.md`, `README` command list, and the runtime ticket/INDEX.

**Acceptance:**

- [ ] `dotfiles-runtime monitors list --format json` returns the schema shape.
- [ ] `source` is `hyprland` on a live host and `unavailable` in a headless
  environment; both exit 0.
- [ ] Disabled and mirrored outputs are absent; order is x/y/connector.
- [ ] `detect_monitors()` behavior and all existing runtime tests are unchanged.
- [ ] The schema file validates the real output in a test.
- [ ] No daemon, no state write, no XDG write.

**Evidence:** `make gates` in runtime; a captured JSON sample; a headless
`source: unavailable` sample; `Verify:` command in the ticket.

---

### REQ-009 — Dropdown primitive + screenshot lane

**Repos:** `ags-capture-tool`.
**Goal:** introduce the reusable field trigger/popover and convert the
screenshot lane; keep every existing option and the screenshot accent.

**Implementation:**

- `ui/shared/field-defs.ts`: pure contract definitions (section 4.2).
- `ui/shared/dropdown.ts` (or `.tsx`): `dropdownField()` builder and
  `DropdownFieldHandle`. Use `Gtk.MenuButton` + `Gtk.Popover` + `Gtk.ListBox`;
  fall back to `Gtk.Button` + explicit `Gtk.Popover.popup()` if MenuButton
  steals Enter or mis-anchors. No GTK import in `field-defs.ts`.
- `ui/classic/ScreenshotPage.tsx`: replace the target/delay/format/output/cursor
  groups with fields. Keep the back/tab/CTA structure and the monitor slot
  (initially populated from the existing GDK topology; the runtime catalog
  lands in REQ-011).
- `ui/classic/ClassicWindow.tsx`: replace the per-option group arrays for the
  screenshot lane with field handles; `applyStateToUi()` sets each field's
  value; cursor comes from `settingsStore`. Add `activePopover`/`closeAllFields`
  and the capture-phase key deferral. Call `syncWindowSize()` after target
  changes only.
- `style.css`: add `.field`, `.field-trigger`, `.field-key`, `.field-value`,
  `.field-chevron`, `.field-popover`, `.field-pop-header`, `.field-pop-title`,
  `.field-pop-desc`, `.field-option`, `.field-option-icon`,
  `.field-option-text`, `.field-option-label`, `.field-option-desc`,
  `.field-radio`, `.field-selected`, `.field-custom-editor`,
  `.field-custom-hint`. Palette tokens only; no hex.
- Keep `bar-group`/`bar-pill` for the mode tabs, back, CTA, and S4 HUD; the
  option groups are gone from S1.
- Width target: screenshot ≤ 700 px. Record the measured width.

**Acceptance:**

- [ ] S1 screenshot shows only the active value for each field; no side-by-side
  option group.
- [ ] Every old option is present in the correct popover (target/delay/format/
  output/cursor).
- [ ] `Cursor` is a two-row popover with `On — draw the pointer` /
  `Off — hide it`; selecting writes `settingsStore` and updates the trigger.
- [ ] The trigger shows key + value + chevron; open state uses the accent tint;
  the popover opens away from the bar edge.
- [ ] `Enter` commits with no popover open; `Space`/`↓` opens; `Esc` closes the
  popover first; `Enter` in the popover selects; focus returns to the trigger.
- [ ] Opening/closing a popover does not change the layer-surface size.
- [ ] `Target` change calls `syncWindowSize()` once; `Monitor` visibility
  follows the rule in D11.
- [ ] Screenshot lane width ≤ 700 px.
- [ ] `make test`, `make conformance`, `make backend`, `make typecheck`,
  `make bundle` pass.
- [ ] Live screenshots: `shot-closed.png`, `shot-cursor-open.png`.

**Evidence:** source contract test for the field definitions, a test for the
cursor persistence path, a test that opening a popover does not call
`syncWindowSize`, live screenshots, and the measured width.

---

### REQ-010 — Recording lane dropdowns + conditional states

**Repos:** `ags-capture-tool`.
**Goal:** convert the recording lane with the same primitive and preserve every
capability, including GIF reflow and custom duration.

**Implementation:**

- `ui/classic/RecordingPage.tsx`: fields target, monitor (conditional), fps,
  format, quality, audio, size, duration, cursor. Use the shared
  `dropdownField()`.
- GIF: `fps` field becomes `GIF FPS` with 10/15/20/30; `audio` field is replaced
  by `size`; preserve `recording.fps` and `recording.audio` across the switch.
  `syncWindowSize()` after the format change only.
- Custom duration: the popover contains the preset rows and an inline
  `Gtk.SpinButton`/entry under `Custom`. `Enter` sets `customDuration` and
  `duration`; `Esc` restores the previous selection. Remove the old inline
  `.custom-duration` bar widget.
- `ClassicWindow.tsx`: replace the recording group arrays with field handles;
  `applyStateToUi()` sets every field; keep `recordingSurfaces`,
  `bar_compact_controls`, and S4 untouched.
- `style.css`: reuse the field classes; add the custom editor styling and the
  recording structural red (tab/CTA/tally/border/open ring). No literal red.
- Width target: recording ≤ 900 px.

**Acceptance:**

- [ ] Recording S1 shows only the active value per field; no side-by-side
  option group.
- [ ] Every old option is present (target/fps/format/quality/audio/size/
  duration/cursor).
- [ ] GIF switches FPS vocabulary and Audio→Size in place; the bar width does
  not jump beyond a small delta; switching back restores the stored values.
- [ ] Custom duration opens an editor inside the duration popover; Enter sets,
  Esc restores; the bar does not grow.
- [ ] Recording red is structural (tab/CTA/tally/border/open ring); fields are
  neutral.
- [ ] Recording lane width ≤ 900 px.
- [ ] S4 live HUD, `recording_controls`, and `bar_compact_controls` are
  unchanged (existing tests stay green).
- [ ] Gates pass; live screenshots: `rec-closed.png`, `rec-format-open.png`,
  `rec-gif.png`, `rec-custom.png`.

---

### REQ-011 — Dynamic monitor dropdown + remove cycle chip

**Repos:** `ags-capture-tool` (consumer), `dotfiles-runtime` (dependency
`REQ-009`).
**Goal:** the Monitor field is populated from the shared catalog, lists every
connected output, and has no cycle button.

**Implementation:**

- Add `ports/monitor-catalog.ts` and
  `adapters/runtime-monitor-catalog.ts`:
  `execAsync(["dotfiles-runtime","monitors","list","--format","json"])`, parse,
  validate `schema_version === 1`, map to `CatalogMonitor[]`, cache 2s, return
  `[]` on any failure (never reject into the UI).
- Add `domain/monitor-catalog.ts` with the pure `mergeMonitors()` rule in
  §2.4 and a shared `compareMonitors()` (x, y, connector).
- Add `monitorCatalog` to `CapturePorts` and `app.tsx`'s `buildPorts()`.
- `ClassicWindow`/pages: build the Monitor field options from
  `mergeMonitors(topology, catalog, selection.focused())`. Re-read on popover
  open and on topology change. If the catalog is unavailable, the GDK fallback
  still renders.
- On select: `selection.selectMonitor(connector)`. Remove the `monitorChip`
  button, `monitorChipLabel`, and the `selection.cycleMonitor()` call from the
  UI. Remove `cycleMonitor` from `SelectionController` and update its tests to
  use `selectMonitor`.
- The `Monitor n` badge/outline in `SelectionOverlay` stays; sort
  `selection.monitors()` with the same `compareMonitors()` so the badge index,
  the dropdown order and the pending pick all agree.
- Update `tests/ts/overlay-contract.test.ts` and
  `tests/ts/selection-controller.test.ts` for the new interaction.
- Test two monitors with `hyprctl output create headless`; record the cleanup.

**Acceptance:**

- [ ] With two outputs, the Monitor field appears for `Target = Screen` in both
  lanes and lists both connected outputs, focused marked.
- [ ] The list comes from the runtime catalog; a fake CLI response with a
  different label changes the row label without a code change.
- [ ] The GDK set remains authoritative: a catalog-only connector is not
  offered; a GDK-only connector still appears with a fallback label.
- [ ] Selecting a row calls `selectMonitor`; the pending outline/badge and
  `Monitor n` update; there is no cycle button and no `cycleMonitor` call.
- [ ] Runtime CLI missing/error → GDK fallback, no crash, no console error
  spam.
- [ ] Hotplug: adding/removing an output refreshes an open Monitor popover.
- [ ] Existing screen capture commit still passes `--monitor <connector>`.
- [ ] Gates pass; live evidence `monitor-open.png` with two outputs.

---

### REQ-012 — Settings cleanup + persistence

**Repos:** `ags-capture-tool`.
**Goal:** remove duplicate defaults, make `capture-ui.json` the authority, and
regroup the panel.

**Implementation:**

- `ui/classic/SettingsPage.tsx`: remove `screenshotGroup` and
  `recordingGroup`; split `general` into `Files`, `Behaviour`, `Placement`;
  add `Runtime` with the backend readout and a `Lane memory` readout. Add the
  header subtitle + `Saved as you go` chip; change the footer to `Enter done`.
- Keep `Recording controls` segmented (current v0.3.1 values) and the compact
  `isEnabled` callback. Add `Top offset` sensitivity driven by `Bar position`
  (extend `numberRow` with an `isEnabled` callback or set `sensitive` after
  render).
- `domain/ui-state.ts`: remove `configDefaults(settings)` from the first-run
  path. `ClassicWindow.applyStateToUi()` uses
  `uiStateStore.load(createUiState())`. Either delete `configDefaults` and
  update its tests, or keep it as a test-only helper that ignores settings;
  production must use `createUiState()`. Tests assert code defaults from
  `createUiState()`. Keep the legacy `CaptureSettings.screenshot.format/output`
  and `CaptureSettings.recording.fps/quality/audio` fields parseable and
  written unchanged; add a deprecation comment. Do not delete them from the
  JSON.
- Keep cursor in `config.json`; `applyStateToUi()`/`settingsChanged()` apply
  `config.screenshot.cursor` / `config.recording.cursor` to the cursor field.
- `ui/shared/settings-defs.ts` (pure) for the group titles/row order; the
  parity test uses it.
- CSS: `.settings-subtitle`, `.settings-save-chip`, `.settings-readout`
  reuse. No hex.
- Update tests: `bar-shell.test.ts` no longer expects the deleted rows; assert
  the new groups and the absence of the old defaults. `domain-ui-state.test.ts`
  no longer expects settings to seed UI defaults. `recording-lifecycle.test.ts`
  keeps the `Recording controls` row assertion.

**Acceptance:**

- [ ] Settings shows Files / Behaviour / Placement / Runtime only; no
  Screenshot or Recording defaults groups.
- [ ] `Recording controls` shows `Top bar | On hover | Always visible`; compact
  disables/off in `On hover` and restores when leaving.
- [ ] `Top offset` is insensitive at `Bottom`, active at `Top`.
- [ ] The backend readout is in Runtime and still guarded against a stale
  in-flight probe.
- [ ] `Lane memory` readout is present.
- [ ] First run uses `DEFAULT_SCREENSHOT`/`DEFAULT_RECORDING`; a settings file
  with old default values does not seed the lane when no `capture-ui.json`
  exists.
- [ ] Existing configs still parse; the backend still reads its cursor/paths/
  pattern/notifications.
- [ ] Footer says `Enter done`; edits still persist immediately.
- [ ] Gates pass; live evidence `settings.png`, `settings-hover.png`.

---

### REQ-014 — Compact/detailed bar field presentation setting

**Repos:** `ags-capture-tool`.
**Goal:** let the user choose the new compact dropdown bar or the old detailed
inline-options bar without duplicating the option vocabulary.

**Implementation:**

- `domain/settings.ts`: add `bar_fields: "compact" | "detailed"` with
  `CONFIG_BAR_FIELDS`, default `compact`, and `mergeSettings` tolerance. The
  backend ignores it.
- `ui/shared/field-defs.ts`: export `BAR_FIELD_PRESENTATIONS` and
  `DEFAULT_BAR_FIELDS` from the mockup contract.
- `ui/shared/dropdown.ts`: add an inline renderer that consumes the same
  `FieldOptionDef[]` and exposes the same `FieldHandle` surface as the compact
  dropdown. No second option table.
- `ScreenshotPage` / `RecordingPage`: choose the renderer from
  `settingsConfig.bar_fields`; switching closes open popovers, preserves the
  current `UiState`, re-renders S1 once, and calls `syncWindowSize()`.
- `SettingsPage` / `settings-defs.ts`: Behaviour → `Bar fields`
  (`Compact | Detailed`), persisted immediately.
- Tests: default compact; missing/corrupt -> compact; detailed renders every
  option inline; switching preserves `UiState`; one `syncWindowSize()` per
  switch; both presentations read the same `field-defs`.
- Live evidence: `detailed-shot.png`, `detailed-rec.png`,
  `settings-bar-fields.png`.

**Acceptance:**

- [ ] Settings shows `Bar fields: Compact | Detailed`, default Compact.
- [ ] Compact is the dropdown bar; Detailed is the inline option-group bar;
  both cover every existing option in both lanes.
- [ ] Switching preserves the current selections and does not commit.
- [ ] `syncWindowSize()` runs once after the switch; no popover is left open.
- [ ] A missing/corrupt `bar_fields` degrades to `compact`.
- [ ] Both presentations consume `field-defs.ts`; no duplicate option table.
- [ ] Gates pass; parity covers the setting and the detailed presentation.

---

### REQ-013 — Mockup parity harness

**Repos:** `ags-capture-tool`.
**Goal:** make drift from the mockup a test failure, not a review opinion.

**Implementation:**

- Copy the staged mockup to
  `tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html`
  and record its SHA-256 in the epic/ticket frontmatter.
- Add `tests/ts/mockup-parity.test.ts` as specified in §4.3. Use only Node
  built-ins; no GTK import.
- Add `ui/shared/field-defs.ts` and `ui/shared/settings-defs.ts` if not already
  created; make the page/window consume them.
- Add the required CSS class/token assertions. If a class is intentionally
  renamed, update the contract and the test in the same commit with user
  approval.
- Wire the test into `make test` (the existing Node test runner picks up
  `tests/ts/*.test.ts`; confirm the Makefile glob).

**Acceptance:**

- [ ] The parity test fails if a label, description, option value, field order,
  default, monitor id, settings row, recording-control value, `bar_fields`
  value, required class, hex literal, or mockup hash changes on one side only.
- [ ] The mockup's own validator shows no drift banner.
- [ ] `make test` includes the parity test and passes.
- [ ] The ticket records the mockup hash and the exact command output.

---

### OPS-008 — Documentation reconciliation

**Repos:** `ags-capture-tool`.
**Goal:** stop a reader or agent from mistaking the historical EPIC-001
mockup/design for the current vocabulary. This is the task that answers “I
still see `Sys`/`Med`/`recording_hud` in the mockup”.

**Implementation:**

- Add a top-of-file HTML banner to
  `tickets/EPIC-001-capture-bar-redesign/mockups/capture-bar-mockups.html`:
  “Historical EPIC-001 mockup (v0.2.x). Current proposal:
  `../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html`.
  This file intentionally retains the old `Sys`/`Med`/`recording_hud`
  vocabulary; do not implement from it.”
- Add a matching top-of-file note to
  `tickets/EPIC-001-capture-bar-redesign/design.md`: “Historical design for
  v0.2.x. Superseded by v0.3.0 `recording_controls` and EPIC-002. Do not
  implement from this file.”
- Update stale code comments that still say `bar.recording_hud` where the code
  now uses `recording_controls`/`recordingSurfaces`:
  `ui/classic/ClassicWindow.tsx` (the `applyHudVisibility`, `enterLiveHud`,
  `commitCurrentMode`, and `settingsChanged` comment blocks) and
  `domain/recording-hud.ts`. Keep the legacy migration comments in
  `domain/settings.ts` — those are accurate and load-bearing.
- Add a short “current references” block to the EPIC-002 epic ticket and the
  repo `tickets/INDEX.md` entry, pointing at the new mockup/design/plan.
- Do **not** rewrite historical ticket evidence, release handoffs, or OPS
  records. They are records; the banner is enough.

**Acceptance:**

- [ ] The old mockup and old design doc carry a visible historical banner.
- [ ] A `rg` over the current-reference implementation files (the EPIC-002
  mockup, `ui/`, `style.css`, `field-defs.ts`, `settings-defs.ts`) finds no
  stale `Sys`/`Med`/`bar.recording_hud` vocabulary. The plan/agent brief may
  mention those terms only in historical/migration context; `domain/settings.ts`
  may mention `bar.recording_hud` for the real legacy migration; historical
  EPIC-001/OPS records are excluded.
- [ ] The EPIC-002 ticket points to the current mockup and plan.
- [ ] No code behaviour changes; gates still pass.
- [ ] The user’s reported stale-reference path is either fixed (if it was a
  current file) or explicitly labeled historical (if it was an EPIC-001
  record). Record the exact file path in the ticket.

**Evidence:** `rg -n` output before/after for the stale terms; the banner
paths; a screenshot/HTML excerpt of the banner.

---

### OPS-007 — Release and pins

**Repos:** `dotfiles-runtime`, `ags-capture-tool`, `dotfiles-v3`.
**Goal:** ship the service and the UI on immutable tags, update the composition
pins, and prove the deployed shape.

**Steps:**

1. Runtime: run `make gates`; tag `v0.6.0` (minor: new CLI command); build the
   sdist/wheel from the tag; publish the release notes.
2. Capture: run `make gates` (test, conformance, backend, typecheck, bundle);
   tag `v0.4.0` (minor: UI change); publish the release notes.
3. `dotfiles-v3`: update `dotfiles/provisioning/cli-tools.yaml` runtime
   `v0.6.0`; update `dotfiles/provisioning/apps.yaml` capture `v0.4.0`. Do not
   change the program tuple (no `ags-platform`/`contracts` change).
4. Run `make gates-ci` and `make deploy-coverage`; record the output.
5. Update capture `tickets/INDEX.md`, epic status, CHANGELOG, and the
   `dotfiles-v3` release record. Immutable tags; never move a published tag.
6. Update `dotfiles-runtime/tickets/INDEX.md` and CHANGELOG.

**Acceptance:**

- [ ] Runtime `v0.6.0` and capture `v0.4.0` are annotated tags on green commits.
- [ ] `dotfiles-v3` pins match the tags; `make deploy-coverage` green.
- [ ] `make gates-ci` green.
- [ ] The installed `dotfiles-runtime monitors list --format json` works from
  the deployed CLI path.
- [ ] The installed capture app shows the new UI and the dynamic Monitor
  dropdown.
- [ ] No published tag moved; rollback is the previous tag pair.

---

## 7. Orchestration protocol (for the orchestrator)

1. **Switch out of Plan mode first.** The user must switch agents; the
   orchestrator cannot create product files in Plan mode.
2. **Create the worktrees/tickets in this order:**
   - `ags-capture-tool`: `scripts/worktree-guard.sh check-clean`, then
     `create EPIC-002 monitor-catalog-dropdowns`; create the epic + child
     tickets; copy the mockup; record the hash.
   - `dotfiles-runtime`: `scripts/worktree-guard.sh create REQ-009
     shared-monitor-catalog`; create the runtime ticket.
   - `dotfiles-v3`: create the pin ticket after the releases exist; never pin
     an unmerged/unreleased tag.
3. **Run the sequence:**
   - `REQ-009` (dropdown primitive/screenshot) and `REQ-008` (runtime service)
     in parallel.
   - `REQ-010` (recording) after `REQ-009`.
   - `REQ-011` (monitor dropdown) after `REQ-008` + `REQ-009`.
   - `REQ-012` (settings) after `REQ-010` + `REQ-011`.
   - `REQ-014` (compact/detailed setting) after `REQ-012`.
   - `REQ-013` (parity) after `REQ-014`; fix any drift before OPS.
   - `OPS-008` (historical banners + stale comment cleanup) after `REQ-012`;
     this is the answer to the user’s “I still see old references” report.
   - `OPS-007` last.
4. **Review every child before the next one starts:** diff, tests, evidence,
   ticket status, INDEX. Reject a child that changes the mockup, the contract,
   a window identity, a palette token, or an unrelated file.
5. **No silent scope expansion.** If an agent finds a missing decision, it
   stops and writes the question in the ticket; the orchestrator asks the user.
   The mockup/contract change requires an explicit user approval and a plan
   update.
6. **Evidence rule:** every non-trivial claim in a ticket has `Evidence:` and
   `Verify:`. A green test is evidence; a screenshot path is evidence; a
   "looks right" is not.
7. **Gates before merge:** capture `make test`, `make conformance`,
   `make backend`, `make typecheck`, `make bundle`; runtime `make gates`;
   dotfiles-v3 `make gates-ci`, `make deploy-coverage`.
8. **Merge only green.** Merge the child to main, update the epic, delete the
   worktree/branch per the repo lifecycle. Tags only after all children and the
   epic are green.
9. **Watch the live app.** The orchestrator must run the app and inspect the
   states in §4.4, not just trust the source tests. The user asked for no drift;
   live screenshots are the final proof.
10. **Report status** in the conversation after each child: ticket id, branch,
    gates, evidence paths, remaining risks.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Capture-phase key controller swallows Enter/Esc before the popover | `activePopover` guard returns `false`; test the full keyboard table; Esc closes only the popover. |
| `Gtk.MenuButton` steals Enter or mis-anchors | Fallback to `Gtk.Button` + `Gtk.Popover.popup()`; test both screen edges and top/bottom placement. |
| Popover opens off-screen on a bottom bar near an edge | `position = TOP` for bottom bar, `BOTTOM` for top; let GTK clamp; test 720p and both edges. |
| Opening a popover resizes/flickers the layer surface | Never call `syncWindowSize()` on open/close; only target/format/placement. Test with a source spy. |
| Palette refresh closes or miscolors an open popover | `theme.apply()` restyles the shared provider; use symbolic icons or register popover icons; test with a palette switch open. |
| Runtime CLI slow/unavailable | 2s cache; `execAsync` catch → `[]`; GDK fallback; never block the UI on the catalog. |
| Catalog and GDK disagree / hotplug timing | GDK is authoritative; join by connector; ignore catalog-only entries; re-read on topology change; keep `Monitor n` order canonical. |
| Removing `configDefaults` breaks first-run tests | Replace with `createUiState()` tests; keep legacy fields parseable; update `domain-ui-state.test.ts`. |
| Settings schema deletion breaks old configs/backend | Do not delete fields; deprecate and keep `mergeSettings`/backend reads. |
| Test labels pin `Sys`/`Med`/old groups | Move assertions to `field-defs.ts`/`settings-defs.ts` and the parity test; update the old source tests deliberately. |
| Width budget missed because GTK fonts differ | Measure `panel.measure`; adjust padding/gaps, not options; stop if > ceiling. |
| Detailed mode overflows a small screen | Detailed is explicitly allowed to be wider; clamp horizontally and record the measured width. Do not shrink the option set. |
| Two presentations drift | Both must consume `field-defs.ts`; parity covers the `bar_fields` setting and the detailed state. |
| Switching presentation while a popover is open | Close all popovers synchronously, preserve `UiState`, then re-render and call `syncWindowSize()` once. |
| Two-monitor test host has one monitor | Use `hyprctl output create headless`; record cleanup; fall back to a unit test with fake descriptors if headless is unavailable. |
| Contracts/program-tuple blast radius | D9: no `contracts` bump; runtime-owned schema; only runtime + capture + composition pins change. |
| Cursor split between settings and UI state | D4: cursor stays in `config.json`; the bar writes it; no migration in this epic. |
| Release tag moved | Immutable annotated tags; a fix is a new patch tag. |

---

## 9. Definition of done

- [ ] `EPIC-002` and every child are `done`; `INDEX.md` agrees.
- [ ] Runtime `v0.6.0` and capture `v0.4.0` tagged on green commits.
- [ ] `dotfiles-v3` pins updated; `make gates-ci` + `make deploy-coverage`
  green.
- [ ] `tests/ts/mockup-parity.test.ts` green; mockup hash recorded.
- [ ] Live evidence matrix in §4.4 complete, with measured widths within
  budget.
- [ ] No literal colours in `style.css`; no window identity change; no
  `capture-window`/`capture-overlay` rename.
- [ ] The installed app shows the dynamic Monitor dropdown from the runtime
  catalog, with a working GDK fallback.
- [ ] Settings no longer shows the duplicate defaults; first run comes from
  code; `capture-ui.json` is authoritative.
- [ ] `Bar fields: Compact | Detailed` exists and both presentations preserve
  the same selections; Detailed is the old inline density.
- [ ] `Enter` still commits; `Space`/`↓` opens; `Esc` closes the popover then
  walks the ladder.

---

## 10. Appendix — exact field vocabulary

Copy from the mockup `design-contract` block; do not retype from memory. The
contract currently declares:

**Screenshot:** `target` (Region/Screen/Window), `monitor` (dynamic),
`delay` (None/3s/5s/10s), `format` (PNG/JPEG), `output` (Clipboard/Save),
`cursor` (On/Off).

**Recording:** `target`, `monitor`, `fps` (std 24/30/60; GIF 10/15/20/30),
`format` (MP4/WebM/GIF), `quality` (Low/Medium/High), `audio` (System/Mic/None),
`size` (Original/75%/50%), `duration` (∞/10s/30s/60s/Custom), `cursor` (On/Off).

**Settings groups:** Files (Screenshot folder, Recording folder, Filename
pattern), Behaviour (Show notifications, Compact bar indicator), Placement (Bar
position, Top offset, Recording controls), Runtime (Recorder backend, Lane
memory).

**Recording controls:** Top bar (`top-bar`), On hover (`hover`), Always
visible (`always`). Default `top-bar`.

**Bar fields:** Compact (`compact`), Detailed (`detailed`). Default
`compact`. Detailed uses the same field vocabulary inline; compact uses the
dropdown triggers.

**First-run code defaults:** screenshot Region/None/PNG/Clipboard/Cursor Off;
recording Region/60/MP4/High/System/∞/Cursor On; GIF 15 fps/Original.

---

## 11. Appendix — commands and evidence

```sh
# Baseline validation
cd ags-capture-tool && git log --oneline --decorate -5 && git tag --sort=-creatordate | head
cd ../ags-platform && git log --oneline --decorate -1
cd ../ags-bar && git log --oneline --decorate -1
cd ../dotfiles-provision && git log --oneline --decorate -1
cd ../dotfiles-v3 && git log --oneline --decorate -1

# Runtime service
cd dotfiles-runtime && make gates
dotfiles-runtime monitors list --format json | tee /tmp/opencode/capture-dropdowns/runtime-monitors.json
# headless fallback: run in an environment without hyprctl and record source=unavailable

# Capture gates
cd ags-capture-tool && make test && make conformance && make backend && make typecheck && make bundle

# Composition
cd dotfiles-v3 && make gates-ci && make deploy-coverage

# Live evidence
grim -o eDP-1 /tmp/opencode/capture-dropdowns/<ticket>/shot-closed.png
hyprctl output create headless          # two-output test
hyprctl output remove HEADLESS-1        # cleanup; confirm the actual name
hyprctl layers                          # layer-shell map/unmap evidence
```

Every ticket records the command, exit code and key output. A screenshot path
without a recorded command is not evidence.

---

## 12. Change control

The mockup and its `design-contract` block are normative. Any of the following
requires an explicit user approval and a plan update before an agent proceeds:

- changing a field label, description, option value, default, field order, or
  the monitor list shape;
- changing the trigger anatomy, popover behavior, keyboard contract, or
  settings groups;
- adding a new repo, a `contracts` bump, an `ags-platform` change, or a
  `monitors watch` daemon;
- changing the Monitor visibility rule (D11) or the cursor persistence
  decision (D4);
- changing the release/pin scope.

If an agent is unsure, it stops at the ticket boundary and asks. It does not
invent a design and it does not edit the mockup.
