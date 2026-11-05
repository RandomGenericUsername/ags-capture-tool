---
id: REQ-012
title: "Settings cleanup + persistence"
kind: requirement
status: proposed
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

- [ ] Settings groups: Files, Behaviour, Placement, Runtime only; no Screenshot
  or Recording defaults groups; no duplicate cursor toggles.
- [ ] `Recording controls` remains `Top bar | On hover | Always visible`;
  compact disables/off in `On hover` and restores after.
- [ ] `Top offset` is insensitive at Bottom, active at Top.
- [ ] Recorder backend readout moves to Runtime and keeps its stale-probe guard;
  `Lane memory` readout is present.
- [ ] First run uses `createUiState()`/code constants; settings no longer seed
  the lane when no `capture-ui.json` exists.
- [ ] Legacy `CaptureSettings.screenshot.format/output` and
  `recording.fps/quality/audio` stay parseable and written unchanged; marked
  deprecated.
- [ ] Cursor stays in `config.json`; the bar dropdown is the only control.
- [ ] Header subtitle, `Saved as you go` chip, footer `Enter done` implemented.
- [ ] Gates pass; live evidence `settings.png`, `settings-hover.png`.

## Implementation map

- `ui/classic/SettingsPage.tsx`, `ui/shared/settings-defs.ts`
- `domain/ui-state.ts`, `ui/classic/ClassicWindow.tsx`
- `domain/settings.ts` — deprecation comments only, no field deletion.
- `style.css` — `.settings-subtitle`, `.settings-save-chip`.
- Update `tests/ts/bar-shell.test.ts`, `tests/ts/domain-ui-state.test.ts`,
  `tests/ts/recording-lifecycle.test.ts`.

## Evidence

Gate output; first-run test; settings screenshots.
