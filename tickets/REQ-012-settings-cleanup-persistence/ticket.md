---
id: REQ-012
title: "Settings cleanup + persistence"
kind: requirement
status: done
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-009, REQ-010, REQ-011]
blocks: [REQ-014, REQ-013, OPS-008, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Settings cleanup + persistence

## Requirement

Remove the duplicate bar defaults from settings and make `capture-ui.json` the
authority after first run.

## Acceptance

- [x] Settings groups: Files, Behaviour, Placement, Runtime only; no Screenshot
  or Recording defaults groups; no duplicate cursor toggles.
- [x] `Recording controls` remains `Top bar | On hover | Always visible`;
  compact disables/off in `On hover` and restores after.
- [x] `Top offset` is insensitive at Bottom, active at Top.
- [x] Recorder backend readout moves to Runtime and keeps its stale-probe guard;
  `Lane memory` readout is present.
- [x] First run uses `createUiState()`/code constants; settings no longer seed
  the lane when no `capture-ui.json` exists.
- [x] Legacy `CaptureSettings.screenshot.format/output` and
  `recording.fps/quality/audio` stay parseable and written unchanged; marked
  deprecated.
- [x] Cursor stays in `config.json`; the bar dropdown is the only control.
- [x] Header subtitle, `Saved as you go` chip, footer `Enter done` implemented.
- [x] Gates pass; live evidence `settings.png`, `settings-hover.png`.

## Implementation map

- `ui/classic/SettingsPage.tsx`, `ui/shared/settings-defs.ts`
- `domain/ui-state.ts`, `ui/classic/ClassicWindow.tsx`
- `domain/settings.ts` — deprecation comments only, no field deletion.
- `style.css` — `.settings-subtitle`, `.settings-save-chip`.
- Update `tests/ts/bar-shell.test.ts`, `tests/ts/domain-ui-state.test.ts`,
  `tests/ts/recording-lifecycle.test.ts`.

## Evidence

Gates (worktree `/home/inumaki/Development/dotfiles/ags-capture-tool/.worktrees/EPIC-002`,
branch `ticket/EPIC-002-monitor-catalog-dropdowns`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# 381 pass / 0 fail + tests tsc clean

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make conformance
# 17 pass / 0 fail

make backend
# 114 passed

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make typecheck
# OK: 0 errors in the ags-capture-tool tree

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make bundle
# OK: build/capture.js (1910444 bytes)
```

First-run evidence: `tests/ts/domain-ui-state.test.ts` asserts
`mergeUiState(createUiState(), {})` equals `DEFAULT_SCREENSHOT` /
`DEFAULT_RECORDING`; `tests/ts/bar-shell.test.ts` asserts
`uiStateStore.load(createUiState())` and that `configDefaults` no longer exists.
`tests/ts/domain-settings.test.ts` still pins the legacy screenshot/recording
fields as parseable.

Live evidence (worktree app run with `ags run -d .`, installed v0.3.1 quit for
the run and restarted afterwards; the worktree app is not running):

- `/tmp/opencode/capture-dropdowns/REQ-012/settings.png` — Top bar selected,
  compact on, Top offset dimmed at Bottom.
- `/tmp/opencode/capture-dropdowns/REQ-012/settings-hover.png` — On hover
  selected, compact switch off/disabled.

