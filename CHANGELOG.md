# Changelog

## v0.6.1 — 2026-11-06

The capture app no longer reads the now-unused capture layout token; the
settings panel width is CSS-owned again.

### Changed

- The settings panel no longer requests `layout.ags-capture.panel-width`; it
  relies on `style.css` `min-width: 560px`, matching the pre-v2 construction.
- `app.tsx`, `ClassicWindow` and `SettingsPage` drop the `panelWidth`
  accessor/prop plumbing. The appearance apply, `configDir` and `palette-refresh`
  wiring are unchanged.

### Removed

- The `layout.ags-capture.panel-width` accessor and `widthRequest` plumbing,
  following the assets repo's removal of `[groups.layout.ags-capture]`.

## v0.6.0 — 2026-11-06

The capture app now consumes the unified v2 Appearance plane: palette, skin and
mode are one generation installed by one composed provider.

### Added

- One module-level `createAppearance({ configDir: "ags-capture" })`, applied in
  `main()`.
- `layout.ags-capture.panel-width` (fallback `560`) drives the settings panel
  width from TSX.

### Changed

- The `palette-refresh` path uses
  `createAppearanceRefreshHandler(appearance, work)`; the platform helper
  re-applies the whole appearance before the app-owned
  `refreshAppAppearance()` fan-out.
- Pins move to `ags-platform` `v0.9.0` and `contracts` `v0.7.0`; CI checks the
  same tags.

### Removed

- The split `theme.apply()` / `skin.apply()` startup, the v1 Theme/Skin imports
  and the app-local palette-refresh wrapper.

### Unchanged

- `style.css` remains the bundled glass fallback, including its local
  `--rec-accent` recording mechanism.
- The capture request surface, window structure, classes, gestures, sizes and
  behavior are unchanged; no request command was added.

## v0.5.0 — 2026-11-05

The capture app now consumes the frozen skin plane: the runtime-expanded
`ags-capture/skin.css` overlays the bundled glass stylesheet at USER priority.

### Added

- One module-level `createAppSkin({ configDir: "ags-capture" })`, applied
  immediately after the palette in `main()`. The skin's composed provider
  carries the live palette roles plus the runtime-expanded skin CSS.
- The adapter's own artifact monitor reloads `skin.css` / `skin.json`; no
  capture request command was added.

### Changed

- Pins move to `ags-platform` `v0.8.0` and `contracts` `v0.6.0` (the
  app-scoped Skin adapter and the 24-token skin plane); CI checks the same
  tags.

### Unchanged

- `style.css` remains the bundled glass fallback, including its local
  `--rec-accent` recording mechanism.
- The palette-refresh handler, window structure, classes, gestures, sizes and
  behavior are unchanged; no layout tokens are consumed in v1.

## v0.4.0 — 2026-11-04

The capture bar now presents options as compact field dropdowns, with a
dynamic Monitor field backed by the shared runtime monitor catalog.

### Added

- One field trigger per S1 option: the active value is visible and the
  alternatives live in a popover. `Enter` commits; `Space`/`↓` opens; `Esc`
  closes the popover first.
- `bar_fields: compact | detailed` (default `compact`). Detailed restores the
  old inline-options density; both presentations use the same field vocabulary.
- Monitor dropdown populated from `dotfiles-runtime monitors list --format json`
  (runtime v0.6.0), with the GDK topology as the authoritative targetable set
  and fallback. The old cycle chip is removed.

### Changed

- The recording lane uses the same field primitive. GIF swaps the FPS vocabulary
  and the Audio→Size slot in place; the custom-duration editor lives inside the
  duration popover (compact) or inline (detailed).
- Settings is regrouped into Files / Behaviour / Placement / Runtime. The
  duplicate Screenshot/Recording defaults are removed; first run uses code
  constants and `capture-ui.json` is authoritative after that.
- Cursor remains in `config.json`; the bar dropdown is the only cursor control.

### Fixed

- Flat field triggers and a single popover card, without the nested
  `Gtk.MenuButton`/theme chrome.
- Field spacing and the two thin row separators match the EPIC-002 mockup.
- The recording cluster pulse reads `--rec-accent` / `@error`; `style.css` has
  no literal hex colours.

## v0.3.0 — 2026-11-04

Recording controls now have one presentation setting shared by the capture
native bar and the top-bar cluster.

### Added

- `recording_controls`: `top-bar` / `hover` / `always`. The old
  `bar.recording_hud` key migrates (`hidden → top-bar`).
- The capture-drawn top-bar cluster and the capture hover/S4 row share one
  `RecordingCluster` component and the bar's accepted `.rec-*` design.
- The top bar reserves a slot only in `top-bar` mode; `hover`/`always` hide the
  slot and use the capture tool's native bar.

### Changed

- `hover` forces the full inline Pause/Stop controls; the compact popover is
  available only for `top-bar` and `always`. The compact switch displays off
  and disabled while `hover` is selected.
- `bar_compact_controls` remains an independent layout preference.

### Removed

- The separate `hidden` recording-HUD mode. Existing configs migrate to
  `top-bar`, so there is always exactly one control surface.

## v0.2.4 — 2026-11-04

The hover-revealed recording controls now stay usable once expanded (BUG-003).
No identity, palette-role, tag-history or deployed-pin changes.

### BUG-003 — hover controls no longer collapse under the pointer

- In `bar.recording_hud = "hover"`, the pointer poll now follows the **current
  visible surface** instead of only the cached resting-bar rect. The trigger is
  the union of the resting bar (142×54 here), the mapped HUD and, when open,
  the Pause/Stop popover's actual `Gdk.Popup` rect. The 1506×54 S1 option lane
  is still never a trigger.
- The compact popover sits at `850,937,220,92` while the resting bar is at
  `889,1026,142,54`; Pause/Stop are above the bar, which is why the old poll
  unmapped them. The non-compact expanded lane measures `839,1034,243,46`.
- Leaving the active surface now hides after a **200 ms grace**, so crossing a
  1 px gap or moving between controls cannot flicker. Re-entry during the grace
  cancels the hide.
- A `Gtk.GestureClick` press/release guard on the HUD row and popover keeps the
  surface mapped for the whole click; an open popover whose geometry cannot be
  measured falls back to staying mapped while it is open. Arm-after-leave and
  first-frame cleanliness are unchanged.
- Hidden `hover` remains **unmapped** and click-through; the exact REQ-007
  resting rect is still the initial trigger.
- Tests add 7 hover cases: expanded-rect union, resting→expanded reveal, leave
  grace, grace re-entry, press hold, collapse back to resting, and source
  wiring. Live probe: Pause and Stop clicked successfully in compact and
  non-compact modes, leave hid the surface, and a click passed through while
  hidden.

### Test coverage

- `make test`: 10/10 unit, 1/1 validation, 331/331 TypeScript, test `tsc`
  clean.
- `make conformance`: 16/16. `make backend`: 114 passed. `make typecheck`: 0
  errors in the ags-capture-tool tree.

## v0.2.3 — 2026-11-04

Hover reveal now follows the configured resting bar (REQ-007). No identity,
palette-role, tag-history or deployed-pin changes.

### REQ-007 — exact bar rectangle for the hover trigger

- `hover` recording HUD now reveals over the **resting bar** (S0 rail,
  142×54 at `889,1026` on the reference host), not the S1 option lane that was
  allocated at Record time (1506×54 at `207,1026`). The surplus was 682 px each
  side — 35.5% of 1920 — which is what JD felt as "too wide".
- The rail allocation is measured while S0 is visible (the hidden rail measures
  0×0 at S1), then combined at commit with the current monitor geometry,
  `bar.position`, `bar.offsetPx`/margins and the monitor's logical origin. Top,
  bottom, offset and resize changes therefore move the trigger.
- The cached measurement carries its monitor connector; a mismatched output
  returns no region instead of revealing from a stale rectangle. Only the bar
  rect triggers: a dock or any other surface in the same edge band is outside
  it.
- Tolerance is explicitly `0 px` (exact bar rect). `growHoverRect()` is tested
  for an optional future 1–4 px tweak but called with zero.
- A failed measurement falls back to the v0.2.2 window-based footprint. The
  unmapped hidden surface, click-through behaviour, arm-after-leave guard,
  50 ms poll and all lifecycle cleanup are unchanged.

### Test coverage

- `make test`: 10/10 unit, 1/1 validation, 324/324 TypeScript, test `tsc`
  clean.
- `make conformance`: 16/16. `make backend`: 114 passed. `make typecheck`: 0
  errors in the ags-capture-tool tree.

## v0.2.2 — 2026-11-04

Hover-region reveal for the live recording HUD (SPIKE-001 option C, REQ-006).
No identity, palette-role, tag-history or deployed-pin changes.

### REQ-006 — full S1 hover reveal without click interception

- In `bar.recording_hud = "hover"`, the S4 window now stays **unmapped** while
  chrome is hidden. The hidden bar area has no input surface, so clicks pass
  through to the application below; only the revealed 76×38 (compact) or
  243×46 (full controls) HUD is mapped and clickable.
- The reveal trigger is the normal S1 bar footprint, captured from the window's
  real allocation and monitor geometry at commit (not a hardcoded
  `1546×54`), so width, target/options and top/bottom placement follow the
  config.
- One 20 Hz poll reads the Hyprland command socket (`j/cursorpos`, one reused
  `Gio.SocketClient`), with `hyprctl -j cursorpos` as fallback. Missing
  Hyprland/socket is a no-op, never a crash. Measured move-to-map latency:
  **20.3 ms** on the reference host.
- Arm-after-leave keeps the first frame clean when the pointer is still on the
  Record CTA at commit: nothing reveals until it leaves the footprint once.
  A revealed HUD is in the clip only while the user is interacting with it,
  matching D9.
- Stop/error/idle, leaving `hover`, window destroy and shutdown stop the poll,
  clear the cached footprint/armed state and unmap the revealed HUD. The GTK
  motion controller defers to the poll so moving within the S1 lane does not
  flicker the HUD.
- Tests add 18 pure units for footprint arithmetic, hit-testing, arm/reveal
  state, malformed cursor replies and the poll/lifecycle wiring. Live probe:
  clean first frames, enter/leave reveal, click-through, stop unmap and
  `hyprctl layers` map/unmap evidence at `/tmp/opencode/capture-hover-c/`.

### Test coverage

- `make test`: 10/10 unit, 1/1 validation, 318/318 TypeScript, test `tsc`
  clean.
- `make conformance`: 16/16. `make backend`: 114 passed. `make typecheck`: 0
  errors in the ags-capture-tool tree. `make bundle`: 1,559,444 bytes.

## v0.2.1 — 2026-11-04

Two confirmed capture behaviour fixes. No identity, palette-role, tag-history or
deployed-pin changes.

### BUG-001 — Settings panel card

- Paint the Settings view on `.capture-view` with an opaque `@surface` card:
  `@on_surface` hairline border, 18px radius and 18px padding. The Settings
  page is a sibling of the bar rows, so it previously had no plate at all and
  its labels floated over whatever window was behind.
- `window#capture-window` stays fully transparent and the bar's own
  `alpha(@surface, 0.92)` plate is unchanged, preserving the first-frame
  no-rectangle behaviour.
- Regression test asserts the opaque Settings surface, border/radius/padding,
  the transparent window, and the unchanged bar plate.

### BUG-002 — minimal region move

- Handle hit-testing now clamps its radius per axis to `(dimension - 1) / 3`,
  capped at the existing 9px pointer radius. A ~15×15 rect therefore keeps a
  centre move zone instead of being covered by eight handle zones; corner and
  edge drags still resize, and normal rects keep the full 9px target.
- `regionPressAt` classifies a press once (resize / move / outside) and the
  overlay uses it, replacing the handle-first branch.
- Tests cover a minimal rect's centre move and corner resize, a normal rect's
  centre move and corner/edge resizes, and the existing negative-origin,
  clamping and coordinate cases remain green.

### Test coverage

- `make test`: 10/10 unit, 1/1 validation, 300/300 TypeScript, test `tsc`
  clean.
- `make conformance`: 16/16. `make backend`: 114 passed. `make typecheck`: 0
  errors in the ags-capture-tool tree.

## v0.2.0 — 2026-11-01

The capture bar redesign: the centred three-page panel is replaced by a
state-driven minimalist bar, the capture flow becomes selection-first with a
separate overlay, recording gains its red accent and live HUD, and the
stylesheet moves to the `palette.v1` semantic roles. Since `v0.1.0`: 24
commits across 69 files (+8,981/−1,275).

### REQ-002 — capture bar shell

- Replace the centred panel with the S0–S4 state machine: S0 is an icon-only
  resting rail (`📷 🎥 ⚙`), S1 opens one mode with a leading `←` back button,
  1:1 screenshot/recording option pills, and the CTA; settings open from S0
  only. The resting rail measures 142×54; the old app was a centred panel.
- Persist placement as `bar.position` (`bottom` default) and `bar.offsetPx`;
  top placement sits below the compositor reserved zone (`reserved_top` +
  offset) and the bar stays non-EXCLUSIVE.
- Keep one live `capture-window` per monitor; focus changes re-map visibility
  only, and the in-place palette refresh still preserves the open surface,
  editor state and shared `UiState`.
- Keep every existing screenshot/recording option, setting and identity
  contract (`capture-window`, `capture-ui`, `app.manifest.json`) unchanged.

### REQ-003 — selection-first flow + overlay window

- Opening a mode engages a persistent, editable pending selection: region dim
  + 8-handle rect (drag/move/resize on one monitor), pointer-following window
  ring + pin, or monitor outline with a `Monitor n` chip when more than one
  monitor exists. Release and hover never capture.
- `Capture`/`Record` or `Enter` commits the on-screen selection as a one-way
  door: selection chrome is hidden synchronously before the backend starts and
  no post-commit editing state exists.
- A dedicated per-monitor `capture-overlay` window (layer TOP, exclusivity
  IGNORE, keymode NONE) holds the selection chrome; the bar remains
  `capture-window` OVERLAY/ON_DEMAND.
- Backend commit flags are additive: `--geometry "X,Y WxH"` / `--monitor` /
  `--window 0x…` for the UI path, legacy argv byte-identical, no slurp
  fallback, vanished window → typed error.
- Esc unwinds one level per press: clear pick → close mode → hide bar.

### REQ-004 — recording lifecycle + HUD

- Recording uses the palette red accent (`--rec-accent: @error`) across the
  active chip, selected pills, CTA and overlay chrome; the CTA label flips
  `Capture → Record`. No hardcoded hex.
- The S4 HUD is driven by `capture.state` from the platform event bus, not
  backend stdout: elapsed time, Pause/Resume and Stop, with paused spans
  excluded from elapsed time.
- `bar.recording_hud` controls S4 visibility: `hidden` (default; ags-bar is
  the sole automatic timer and the capture bar stays out of recordings),
  `always` (Sheet 3 HUD mapped and therefore recorded), `hover` (chrome on
  pointer entry). A launcher/keybind mid-recording presents the HUD in
  `hidden` without altering the capture; Stop stays reachable in every mode.
- `bar_compact_controls` keeps its meaning: compact moves Pause/Stop into the
  popup; otherwise the bar carries them. Options are locked while live and
  the HUD survives `palette-refresh` in place.

### REQ-005 — palette.v1 role CSS

- Migrate `style.css` from legacy `@color_*` carriers to the semantic
  `palette.v1` roles projected by `ags-platform` v0.4.0: `@on_surface`,
  `@surface`, `@primary`/`@on_primary`, `@on_error`, `@outline_variant` and
  `@error`. Mapping is by intent per site; geometry, alpha values, selectors
  and the palette-refresh path are unchanged.
- Paired ink makes recording controls readable (`@on_error` on `@error`,
  7.72:1 instead of 1.31:1) and uses `@on_primary` on the primary accent.
- Pin `ags-platform` v0.4.0 while `contracts` stays v0.3.0, and add a
  validation gate that fails on any returning `@color_*` carrier.

### Known verification limits at release

These were open when `v0.2.0` was tagged. They are tracked for closure in
`tickets/OPS-001-release-record-v0.2.0/`; no acceptance box is ticked by this
entry.

- **Overlay never captured (FR-10):** commit ordering and the synchronous
  hide→launch path are tested, but no manual 2-second clip with a pending
  selection was produced, so the recorded proof is missing.
- **Recorded-clip proof for HUD `hidden` vs `always`:** the visibility rule,
  settings tolerance and wiring are tested, but no recording was produced to
  show the HUD absent in `hidden` and present in `always`.
- **Backend commit flags additive proof:** the additive flags, no-slurp path,
  typed vanished-window error and legacy argv parity are pinned by tests, but
  a live end-to-end commit through the overlay was not captured as an
  artifact.
- **`scale≠1` geometry untested:** the host exposes a single `scale=1`
  output, so GDK/hyprctl/grim coordinate equality on a scaled or
  negative-origin output is unmeasured.
- **HUD in clip:** whether the S4 surface actually lands in recorded frames
  is reasoned from layer/compositor semantics, not observed in a clip.

### Release record

- Tag: annotated `v0.2.0` at `1897607`, 2026-11-01 23:09:15 -0500. The tag
  message remains the original `v0.2.0 — CSS on palette.v1 roles (REQ-005)`.
- This changelog section and the GitHub release notes were corrected on
  2026-11-04 to describe the full release. Code and the deployed pin did not
  change; no `v0.2.1` was cut.

## v0.1.0 — 2026-10-27

- Extract `capture-tool` from `ags-apps` v0.5.0 into the standalone
  `ags-capture-tool` repo (repo root is the app package).
- Identity: app/instance `capture`, config dir `ags-capture`, window
  `capture-window`, launcher `capture-ui`, keybind description “Open capture
  UI”, mode `live`, `holdsUnsavedState: false`.
- Replace the Theme-only v0.5.0 handler with a real `palette-refresh`: re-apply
  the Theme pointer, clear the built icon images, reload the generated capture
  icons in every live per-monitor window, re-measure the surface, and preserve
  the active view, settings/path editor and the one shared `UiState`.
- Add handler, conformance and state-preservation tests, including the
  in-flight `busy` path and monitor-unregister behaviour.
- Preserve `bin/capture-tool` and the Python backend pytest suites.
- Add the standalone dev flow (`AGENTS.md`, tickets, worktree guard, Makefile,
  CI, tests, frozen `templates/ags-app/`) and pin the local-only v0.3.0
  `ags-platform`/`contracts` tuple via `.dev/`.
