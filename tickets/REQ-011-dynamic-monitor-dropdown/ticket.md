---
id: REQ-011
title: "Dynamic monitor dropdown + remove cycle chip"
kind: requirement
status: done
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

- [x] `ports/monitor-catalog.ts` and `adapters/runtime-monitor-catalog.ts` read
  `dotfiles-runtime monitors list --format json`, validate `schema_version: 1`,
  cache for 2 s, and return `[]` on any failure.
- [x] `domain/monitor-catalog.ts` merges the GDK targetable set with the
  catalog by connector; GDK-only entries get a fallback label; catalog-only
  entries are not offered.
- [x] With two outputs, Monitor appears for `Target = Screen` in both lanes and
  lists both outputs with the focused one marked.
- [x] Selecting a row calls `selection.selectMonitor(connector)`; the pending
  outline/badge and `Monitor n` update; no `cycleMonitor` call remains.
- [x] `selection.monitors()` is sorted with the same comparator so the badge,
  dropdown and pending pick agree.
- [x] Hotplug refreshes an open Monitor popover; runtime CLI failure falls back
  to GDK without a crash.
- [x] Existing screen commit still passes `--monitor <connector>`.
- [x] Gates pass; live evidence `monitor-open.png` with two outputs.

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

### Gates (worktree `.worktrees/EPIC-002`, branch `ticket/EPIC-002-monitor-catalog-dropdowns`)

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# exit 0; 383 tests pass; tests/ts tsc --noEmit exit 0

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
# exit 0; build/capture.js 1898976 bytes
```

### Source tests

- `tests/ts/monitor-catalog.test.ts` — `compareMonitors()` x/y/connector
  order; GDK-authoritative merge (catalog-only dropped, GDK-only fallback);
  focus-port precedence and catalog-focus fallback; connector row label +
  detail label/focus; payload validation (`schema_version != 1`, invalid JSON,
  malformed rows); adapter 2 s cache including failure caching; never rejects;
  fake `dotfiles-runtime` on `PATH` changes the row label; composition-root
  port wiring.
- `tests/ts/selection-controller.test.ts` — `selectMonitor()` replaces
  `cycleMonitor()`; canonical monitor order drives `monitorIndex`/badge;
  focused pick stays the default; topology refresh keeps the session.
- `tests/ts/overlay-contract.test.ts` — Monitor is a dropdown built from
  `mergeMonitors()`; no `monitor-chip`/`monitorChip`/`cycleMonitor` remains.

### GDK fallback (installed runtime v0.5.2 lacks the command)

`dotfiles-runtime monitors list --format json` on this host exits 2 with
`No such command 'monitors'.` The app still rendered both outputs from GDK:
`/tmp/opencode/capture-dropdowns/REQ-011/monitor-open-gdk-fallback.png`.
No crash and no CLI error spam in
`/tmp/opencode/capture-dropdowns/REQ-011/ags-fallback.log` (only the normal
per-monitor open messages and an unrelated GDK frame-timing warning).

### Fake CLI (catalog path)

`/tmp/opencode/capture-dropdowns/REQ-011/bin/dotfiles-runtime` is a fake
`monitors list --format json` response with labels `Fake Panel 9000` and
`Fake External 4K`. Started with that directory first on `PATH`, the live
Monitor popover showed those labels without a code change:
`/tmp/opencode/capture-dropdowns/REQ-011/monitor-open.png`; selecting
`HEADLESS-2` updated the trigger and pending pick:
`/tmp/opencode/capture-dropdowns/REQ-011/monitor-selected-headless.png`.
Log: `/tmp/opencode/capture-dropdowns/REQ-011/ags-catalog.log`.

### Live evidence and cleanup

- `monitor-open.png` — two outputs, `Target = Screen`, Monitor popover lists
  both rows, `eDP-1` marked focused, catalog labels visible.
- `monitor-open-gdk-fallback.png` — same state with the real installed runtime
  (no `monitors` command): GDK fallback rows, focused marker, no crash.
- `monitor-selected-headless.png` — `HEADLESS-2` selected; trigger and pending
  pick follow.
- Output created with `hyprctl output create headless` (`HEADLESS-2` at
  `1920,0`); removed with `hyprctl output remove HEADLESS-2`. Verified
  `hyprctl monitors -j` is back to only `eDP-1`.
- The worktree app was quit (`ags quit -i capture`); no worktree `ags run -d .`
  process remains. The installed capture app was restarted afterwards
  (`ags run -d /home/inumaki/.config/ags-capture`).
