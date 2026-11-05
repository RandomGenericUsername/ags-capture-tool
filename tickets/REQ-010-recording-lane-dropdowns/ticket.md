---
id: REQ-010
title: "Recording lane dropdowns + conditional states"
kind: requirement
status: done
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-009]
blocks: [REQ-012, REQ-013, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Recording lane dropdowns + conditional states

## Requirement

Convert the recording lane to the shared field primitive and preserve every
capability, including GIF reflow and custom duration.

## Acceptance

- [x] Fields: Target, Monitor (conditional), FPS/GIF FPS, Format, Quality,
  Audio/Size, Duration, Cursor; no side-by-side option group remains.
- [x] GIF switches FPS to 10/15/20/30 and Audio→Size in the same slot; the bar
  does not jump; switching back restores the stored values.
- [x] Custom duration is an editor inside the duration popover; Enter sets,
  Esc restores; the bar does not grow.
- [x] Recording red is structural (tab/CTA/tally/border/open ring); fields stay
  neutral.
- [x] Recording lane width ≤ 900 px, measured and recorded.
- [x] S4 HUD, `recording_controls` and `bar_compact_controls` are unchanged.
- [x] Gates pass; live evidence: `rec-closed.png`, `rec-format-open.png`,
  `rec-gif.png`, `rec-custom.png`.

## Implementation map

- `ui/classic/RecordingPage.tsx`
- `ui/classic/ClassicWindow.tsx` — recording field handles and `applyStateToUi`.
- `style.css` — custom editor + recording structural red.
- Remove the old inline `.custom-duration` bar widget.

## Evidence

Gate output; measured width; live screenshots; GIF round-trip test.

### Gates (worktree `.worktrees/EPIC-002`, branch `ticket/EPIC-002-monitor-catalog-dropdowns`)

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# exit 0; 367 tests pass; tests/ts tsc --noEmit exit 0

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
# exit 0; build/capture.js 1867684 bytes
```

### Measured width

Live app from this worktree (`ags run -d .`), recording lane open, Target
Screen (single monitor, so Monitor is hidden by D11):

```sh
hyprctl layers -j | jq -r '.[] | .levels[] | .[] |
  select(.namespace=="capture" and .w < 1900) | "x=\(.x) w=\(.w) h=\(.h)"'
# MP4 closed:    x=609 w=703 h=64
# GIF:           x=601 w=719 h=64
# GIF + custom:  x=601 w=719 h=64   (editor open: no growth)
```

Max 719 px ≤ 900 px ceiling. The 16 px GIF delta is the different FPS/Size
vocabulary, not a layout rebuild.

### Live evidence

- `/tmp/opencode/capture-dropdowns/REQ-010/rec-closed.png` — recording lane,
  one trigger per field, MP4/60/High/Audio/Duration/Cursor, width 703 px.
- `/tmp/opencode/capture-dropdowns/REQ-010/rec-format-open.png` — Format
  popover open (MP4/WebM/GIF), red open ring, fields neutral.
- `/tmp/opencode/capture-dropdowns/REQ-010/rec-gif.png` — GIF conditional:
  `GIF FPS 15 fps`, `Size Original` in the Audio slot, width 719 px.
- `/tmp/opencode/capture-dropdowns/REQ-010/rec-custom.png` — Custom duration
  editor inside the duration popover (`120 s`, Set, Enter/Esc hint); width
  stays 719 px.
- `/tmp/opencode/capture-dropdowns/REQ-010/rec-custom-enter.png` — Enter in the
  editor committed `121s` to the trigger.
- `/tmp/opencode/capture-dropdowns/REQ-010/rec-custom-esc.png` — Esc restored
  the previous `121s` selection and closed the popover.

All screenshots are from the clean tree (`ags run -d .` in this worktree); no
temporary evidence hook is present in this commit. The installed v0.3.1 app was
quit for the run and restarted afterwards.

### Source tests

- `tests/ts/dropdown-field.test.ts` — recording lane exact mockup-contract
  parity (field order, defaults, keys, descriptions, both FPS variants, every
  option tuple), typed-value round trip, GIF vocabulary/slot round trip, and
  no `syncWindowSize` in any field open/close path.
- `tests/ts/custom-duration-spin.test.ts` — the duration editor is a popover
  footer, not a bar child; Enter commits, Esc restores; the editor is built
  once and only shown/hidden; neither the editor nor a popover resizes the bar.
- `tests/ts/bar-shell.test.ts` — the recording lane is one trigger per field
  and no `bar-group`/`bar-pill` remains; every old option lives in
  `ui/shared/field-defs.ts`; `applyStateToUi` sets each trigger value.
- `tests/app-contract.test.mjs` — the window's rail icons still use the shared
  appearance slots after the field pages moved to symbolic icons.
