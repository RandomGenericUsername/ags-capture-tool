---
id: REQ-002
title: "Capture bar shell — five-state S0–S4, placement, on-demand pills"
kind: requirement
status: done
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Capture bar shell

## Requirement

Implement the bar shell per
[tickets/EPIC-001-capture-bar-redesign/design.md](../EPIC-001-capture-bar-redesign/design.md)
§3–§7: the S0–S4 state machine, preset-C composition with the leading back
button, bottom/top placement with auto-slot and manual offset, focused-monitor
visibility, and 1:1 migration of all existing pill options and settings —
without touching the identity tuple, window name or palette-refresh contract.

## Acceptance

- [x] Bar at rest (S0) is a single widget group anchored bottom (default) on
      the focused monitor containing exactly `📷 · 🎥 · ⚙` icon buttons, no
      labels, ≤ 210px wide (frame: Sheet 3 `S0`).
- [x] `app.manifest.json` identity unchanged (`app/instance=capture`,
      `configDir=ags-capture`, `mode=live`, `holdsUnsavedState: false`);
      launcher `capture-ui` still toggles; `style.css` still selects
      `window#capture-window`. Verify: `make conformance` passes unchanged
      manifest checks.
- [x] One live window per monitor survives (appearance registry contract);
      only the focused monitor's window is visible, and focus changes re-map
      visibility without destroying/recreating windows or resetting shared
      UI state. Verify: a TS test in the style of
      `tests/ts/state-preservation.test.ts` covering two monitors.
- [x] `←` chevron (34px round) leads every opened state; tapping it or `Esc`
      returns to S0; tapping the other mode icon switches lanes without
      returning home (INV-2; transition table design.md §3).
- [x] S1 screenshot pills carry exactly the existing screenshot vocabulary
      from `domain/settings.ts` L16–34: target (Region/Screen/Window),
      delay, format (png/jpeg), output (clipboard/save), cursor — every
      option still user-reachable; none dropped.
- [x] ⚙ opens the settings surface from S0 only (INV-3); dirs, filename
      pattern, notifications and rendering settings survive.

- [x] Placement persisted as `bar.position` (`bottom` default) and
      `bar.offsetPx` (default 0) through the existing UI-state store chain;
      corrupt/missing values degrade to defaults via `configOneOf`/
      `configString` tolerance, no throw (settings tolerance rule,
      settings.ts L63–73).
- [x] Top placement (design.md D3/§11.4): margin = `AstalHyprland.Monitor.reserved_top` (+ `hyprctl -j monitors` `reserved` fallback) + `bar.offsetPx`; verified no overlap with ags-bar (48px reserved zone) at offset 0; the bar MUST NOT be EXCLUSIVE (no self-offset feedback). Manual verification scenario documented in ticket evidence.
- [x] `baseline` regression: `make test`, `make conformance` green;
      `make typecheck`, `make bundle` green locally.

## Evidence

### 1. S0 rail (three icons, no labels, ≤210px)

- `ui/classic/ClassicWindow.tsx:370-409` — the S0 `capture-bar rail` contains
  exactly three buttons: camera icon, video icon, `⚙`; no text labels.
- `ui/classic/ClassicWindow.tsx:322-330` — default anchor is
  `Astal.WindowAnchor.BOTTOM` when `bar.position` is `bottom`.
- `style.css:34-77` — rail/pill chrome; `style.css:44-57` bar padding and
  `style.css:59-77` 38px icon targets. GTK4 CSS has no `max-width` (a live run
  logged `No property named "max-width"`), so the ceiling is the content.
- `tests/ts/bar-shell.test.ts:36-56` — source assertions for exactly three
  rail buttons, no labels, and the width inputs.
- Live check (temporary instance `capturetest`, instance name changed only in
  `/tmp`, never in the repo): `hyprctl layers` reported the S0 surface at
  `xywh: 889 1026 142 54` (bottom) and `xywh: 889 48 142 54` (top) — 142px
  wide, under 210px.

### 2. Identity and launcher contracts unchanged

- `app.manifest.json` is not modified in this branch (`git diff` empty for the
  file); `ui/classic/ClassicWindow.tsx:49` still declares
  `const WINDOW_NAME = "capture-window"` and the window still uses
  `name="capture-window"`.
- `tests/app-contract.test.mjs:180-201` (identity/launcher/CSS) and
  `tests/ts/window-identity.test.ts:227-263` pass unchanged.
- `make conformance` → 16/16 passing, exit 0 (see gate block below), including
  the unchanged manifest checks.

### 3. One live window per monitor; focus visibility only

- `adapters/monitor-window-set.ts:91-104` — `applyFocusVisibility()` maps focus
  to visibility through `planFocusVisibility`; it only assigns `.visible`.
- `adapters/monitor-window-set.ts:132-145` — opening any owned window sets the
  app-wide `open` flag and immediately maps exactly the focused window.
- `adapters/monitor-window-set.ts:177` — `focus.subscribe(() =>
  applyFocusVisibility())`; no focus path calls `createWindow`,
  `add_window`, `remove_window` or `destroy`.
- `domain/monitor-registry.ts:226-257` — pure `visibleKeyForFocus` /
  `planFocusVisibility` return the caller's same binding objects.
- `tests/ts/focused-visibility.test.ts:65-104` — two monitors executed: opening
  shows one, switching focus re-maps without changing window identity/destroy
  counts, and shared `UiState` identity/selection survive.
- Existing `tests/ts/state-preservation.test.ts` still passes, so the
  appearance registry / in-place refresh contract is intact.

### 4. Back chevron, Esc and lane switch

- `domain/bar-state.ts:30-55` — `openMode` (lane switch), `openSettings` (S0
  only), `back` (one level).
- `ui/classic/ClassicWindow.tsx:259-282` — Esc backs one level then hides from
  S0; Enter commits only in S1; `commitCurrentMode` follows the open lane.
- `ui/classic/ClassicWindow.tsx:413-424` — `←` (`class="bar-back"`) leads the
  opened row; both mode icons remain tappable and call `selectMode`.
- `style.css:79-101` — 34px round back button.
- `tests/ts/bar-state.test.ts:36-84` — S0→S1, lane switch, back/Esc one level,
  settings S0-only, Enter action.
- `tests/ts/bar-shell.test.ts:107-115` — back leads, CTA closes the row.

### 5. Screenshot S1 vocabulary

- `ui/classic/ScreenshotPage.tsx:58-219` — target `Region/Screen/Window`,
  delay `None/3s/5s/10s`, format `PNG/JPEG`, output `Clipboard/Save`,
  cursor `Cursor/Off`.
- `ui/classic/ClassicWindow.tsx:196-200,293` — cursor writes through
  `settingsStore.save` and is re-applied from `config.screenshot.cursor`;
  `ui/classic/ClassicWindow.tsx:203-207,302` does the same for recording.
- `tests/ts/bar-shell.test.ts:58-76` — every screenshot pill label is present.
- No existing option was removed: the recording lane additionally keeps
  `MP4/WebM/GIF`, `∞/10s/30s/60s/Custom` and the GIF size/fps rows
  (`ui/classic/RecordingPage.tsx:171-435`), so the old panel's full vocabulary
  survives.

### 6. Settings surface from S0 only

- `ui/classic/ClassicWindow.tsx:404` — the only `openSettingsView` call is the
  S0 gear button (block `:370-409`), before the opened row.
- `domain/bar-state.ts:38-40` — `openSettings` is a no-op outside S0 (INV-3).
- `ui/classic/SettingsPage.tsx:135-280` — General (dirs, filename pattern,
  notifications, compact controls, bar position/offset), Screenshot and
  Recording groups all survive; recorder backend readout unchanged.
- `tests/ts/bar-shell.test.ts:117-140` — one settings entry, inside S0, and
  all settings rows present.

### 7. `bar.position` / `bar.offsetPx` persistence and tolerance

- `domain/settings.ts:36-38,59` — `CaptureSettings.bar` with defaults
  `{ position: "bottom", offsetPx: 0 }`.
- `domain/settings.ts:73,88-90,124-131` — `CONFIG_BAR_POSITIONS`,
  `configNumber` (finite numbers only) and per-field merge with a non-negative
  rounded offset.
- `ui/classic/SettingsPage.tsx:187-210` — “Bar position” pill row and
  “Top offset” numeric row, persisted through the existing
  `settingsStore.save` on every change.
- `tests/ts/domain-settings.test.ts:146-176` — missing defaults, valid
  round-trip, corrupt `bar` section, corrupt keys, NaN/Infinity/strings and
  negative offsets all degrade without throwing.
- Store-chain note: design.md §6 (normative) names
  `domain/settings.ts` + `adapters/glib-settings-store.ts`; the ticket’s
  “UI-state store chain” wording conflicts with that. `domain/ui-state.ts`
  holds last-used mode selections only, so this ticket uses the settings chain
  and creates no second source.

### 8. Top placement, no overlap, non-exclusive

- `domain/bar-placement.ts:23-37` — `barMarginTop("top", reserved, offset)` =
  `reserved + offset`; bottom is 0; corrupt values degrade to 0.
- `domain/monitor-reserved.ts:27-50` — parses `hyprctl -j monitors`
  `reserved[1]` (top), with focused/first fallback and null on corruption.
- `adapters/hyprland-monitor-reserved.ts:33-74` — dynamic
  `gi://AstalHyprland` primary; `hyprctl -j monitors` synchronous fallback.
  Measured live: AstalHyprland reports `reserved_top = 0` on this host while
  `hyprctl` reports `[0, 48, 0, 0]`; a zero is treated as “not populated” and
  falls through to `hyprctl` (source assertion:
  `tests/ts/bar-shell.test.ts:151-157`).
- `ui/classic/ClassicWindow.tsx:104-119,322-330` — sets anchor
  TOP/BOTTOM, `margin_top = barMarginTop(...)`, `margin_bottom = 0`.
- `ui/classic/ClassicWindow.tsx:327` — `exclusivity={Astal.Exclusivity.IGNORE}`;
  no `EXCLUSIVE` anywhere.
- `tests/ts/bar-placement.test.ts:10-31` and
  `tests/ts/monitor-reserved.test.ts:26-53` — arithmetic, fallback parse and
  corrupt-input tolerance.
- Manual scenario executed on this host (Hyprland, eDP-1 1920×1080):
  1. `hyprctl -j monitors` → `"reserved": [0, 48, 0, 0]` (ags-bar zone).
  2. `hyprctl layers` while ags-bar is up → `gtk4-layer-shell` at
     `xywh: 0 0 1920 48`.
  3. Temporary `capturetest` instance with `bar.position=top, offsetPx=0`,
     toggled once → overlay layer `capture` at `xywh: 889 48 142 54`:
     top edge 48, exactly below ags-bar, no overlap.
  4. Same instance with `bar.position=bottom` → `xywh: 889 1026 142 54`
     (bottom edge 1080), proving the default bottom anchor.
  The temporary instance was quit and its `/tmp` tree removed; the repo and the
  live `capture` instance were not modified.

### 9. Gates (exact output captured in this worktree)

- `make test` → exit 0:
  `ℹ tests 190`, `ℹ pass 190`, `ℹ fail 0`, followed by
  `tsc --noEmit -p tests/tsconfig.tests.json` with no errors.
- `make conformance` → exit 0: `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`.
- `make typecheck` → exit 0:
  `tolerated third-party errors (/usr/share/ags/js): 28`,
  `tolerated ags-platform errors (external unit): 0`,
  `OK: 0 errors in the ags-capture-tool tree`.
- `make bundle` → exit 0:
  `OK: build/capture.js (1093268 bytes)`.
- `make backend` was not needed for this UI-only ticket and was not run.
