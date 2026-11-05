---
id: REQ-009
title: "Dropdown primitive + screenshot lane"
kind: requirement
status: done
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: []
blocks: [REQ-010, REQ-011, REQ-012, REQ-013, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Dropdown primitive + screenshot lane

## Requirement

Introduce the reusable field trigger/popover and convert the screenshot lane.
Every existing screenshot option survives; only its presentation changes.

## Acceptance

- [x] `ui/shared/field-defs.ts` is pure (no `ags/*`, no `gi://*`) and matches the
  mockup `design-contract` for the screenshot lane.
- [x] `ui/shared/dropdown.ts` exposes `dropdownField()` and a handle with
  `setValue`, `setOptions`, `setEnabled`, `setVisible`, `open`, `close`,
  `isOpen`, `destroy`.
- [x] S1 screenshot shows one trigger per field (Target, Monitor placeholder,
  Delay, Format, Output, Cursor); no side-by-side option group remains.
- [x] Every old option is present in the correct popover; Cursor is
  `On — draw the pointer` / `Off — hide it` and persists through
  `settingsStore`.
- [x] Enter commits when closed; Space/↓ opens; Esc closes the popover first;
  Enter in the popover selects; focus returns to the trigger.
- [x] Opening/closing a popover does not call `syncWindowSize()`; Target change
  does.
- [x] Screenshot lane width ≤ 700 px, measured and recorded.
- [x] `make test`, `make conformance`, `make backend`, `make typecheck`,
  `make bundle` pass.
- [x] Live evidence: `shot-closed.png`, `shot-cursor-open.png`.

## Implementation map

- `ui/shared/field-defs.ts`, `ui/shared/dropdown.ts`
- `ui/classic/ScreenshotPage.tsx`
- `ui/classic/ClassicWindow.tsx` — field handles, `activePopover`,
  `closeAllFields`, key deferral, `syncWindowSize`.
- `style.css` — `.field-*` classes; palette tokens only.

## Evidence

Gate output; measured width; live screenshots; source test that the popover
open path does not call `syncWindowSize`.

### Gates (worktree `.worktrees/EPIC-002`, branch `ticket/EPIC-002-monitor-catalog-dropdowns`)

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# exit 0; 368 tests pass; tests/ts tsc --noEmit exit 0

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make conformance
# exit 0; 17 tests pass

make backend
# exit 0; 114 passed

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make typecheck
# exit 0; 0 errors in the ags-capture-tool tree

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make bundle
# exit 0; build/capture.js 1833540 bytes
```

### Measured width

Live app from this worktree (`ags run -d .`), screenshot lane open, Target
Region (Monitor hidden by D11):

```sh
hyprctl layers -j
# capture surface: x=612 y=1015 w=697 h=65   (bottom bar)
# top-bar run in the same session also measured w=697 h=65
```

The layer width is `panel.measure(Gtk.Orientation.HORIZONTAL, -1)` after
`syncWindowSize()`; 697 px ≤ 700 px ceiling.

### Live evidence

- `/tmp/opencode/capture-dropdowns/REQ-009/shot-closed.png` — S1 screenshot
  lane, one trigger per field, width 697 px.
- `/tmp/opencode/capture-dropdowns/REQ-009/shot-cursor-open.png` — Cursor
  popover open (`On · Draw the pointer`, `Off · Hide the pointer`), opened from
  the live app with keyboard focus (Tab to Cursor, Space), then Esc closed the
  popover while the lane stayed open.

Both screenshots are from the clean tree (`ags run -d .` in this worktree);
no temporary evidence hook is present in this commit.

### Source tests

- `tests/ts/dropdown-field.test.ts` — field-defs purity, exact mockup-contract
  parity, typed-value round trip, handle surface, no `syncWindowSize` on
  popover open/close, Target still calls it, capture-phase deferral, commit
  closes fields, Cursor writes `settingsStore`, `.field-*` CSS classes and no
  literal hex in the field block.
- `tests/ts/bar-shell.test.ts` — screenshot lane is one trigger per field and
  no `bar-group`/`bar-pill` remains; every old option lives in
  `ui/shared/field-defs.ts`; `applyStateToUi` sets each trigger value.
