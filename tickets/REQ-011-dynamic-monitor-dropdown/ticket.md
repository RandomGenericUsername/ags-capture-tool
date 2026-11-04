---
id: REQ-011
title: "Dynamic monitor dropdown + remove cycle chip"
kind: requirement
status: proposed
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-008, REQ-009]
blocks: [REQ-012, REQ-013, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Dynamic monitor dropdown + remove cycle chip

## Requirement

The Monitor field is populated from the shared runtime catalog, lists every
connected output, and has no cycle button.

## Acceptance

- [ ] `ports/monitor-catalog.ts` and `adapters/runtime-monitor-catalog.ts` read
  `dotfiles-runtime monitors list --format json`, validate `schema_version: 1`,
  cache for 2 s, and return `[]` on any failure.
- [ ] `domain/monitor-catalog.ts` merges the GDK targetable set with the
  catalog by connector; GDK-only entries get a fallback label; catalog-only
  entries are not offered.
- [ ] With two outputs, Monitor appears for `Target = Screen` in both lanes and
  lists both outputs with the focused one marked.
- [ ] Selecting a row calls `selection.selectMonitor(connector)`; the pending
  outline/badge and `Monitor n` update; no `cycleMonitor` call remains.
- [ ] `selection.monitors()` is sorted with the same comparator so the badge,
  dropdown and pending pick agree.
- [ ] Hotplug refreshes an open Monitor popover; runtime CLI failure falls back
  to GDK without a crash.
- [ ] Existing screen commit still passes `--monitor <connector>`.
- [ ] Gates pass; live evidence `monitor-open.png` with two outputs.

## Implementation map

- `ports/monitor-catalog.ts`, `adapters/runtime-monitor-catalog.ts`
- `domain/monitor-catalog.ts`
- `ports/capture-ports.ts`, `app.tsx`
- `ui/classic/ClassicWindow.tsx`, `ScreenshotPage.tsx`, `RecordingPage.tsx`
- `ui/overlay/controller.ts` — remove `cycleMonitor`; sort `monitors()`.
- Update `tests/ts/overlay-contract.test.ts`,
  `tests/ts/selection-controller.test.ts`.

## Evidence

Fake CLI test with a different label; GDK-only/catalog-only merge tests;
two-output live evidence using `hyprctl output create headless` with cleanup.
