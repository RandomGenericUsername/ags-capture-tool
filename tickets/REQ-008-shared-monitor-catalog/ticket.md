---
id: REQ-008
title: "Shared monitor catalog service"
kind: requirement
status: done
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [dotfiles-runtime, ags-capture-tool]
depends-on: []
blocks: [REQ-011, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Shared monitor catalog service

## Requirement

Add a read-only, language-agnostic monitor catalog to `dotfiles-runtime`:

```sh
dotfiles-runtime monitors list --format json
```

It returns the connected, enabled, non-mirrored Hyprland outputs with stable
connector ids, labels, geometry, scale, transform, focus and mirror metadata.
The runtime's wallpaper code and the capture tool consume the same descriptors.

## Acceptance

- [x] `dotfiles-runtime monitors list --format json` emits `schema_version: 1`,
  `source`, and `monitors[]` with the contract in `design.md` §2.2.
- [x] Disabled and mirrored outputs are filtered; order is x, y, connector.
- [x] Headless/unavailable returns exit 0 with `source: "unavailable"` and
  `monitors: []`.
- [x] `IMonitorSource.detect_monitors()` behavior and all existing runtime tests
  are unchanged.
- [x] A runtime-owned schema at
  `dotfiles-runtime/contracts/schemas/monitors-list.schema.json` validates the
  real output in a test.
- [x] No daemon, no state write, no XDG write.
- [x] Runtime `make gates` passes; CHANGELOG/README/ticket/INDEX updated.

## Implementation map

- `src/runtime/ports/monitor_catalog.py` — sibling port; do not add an abstract
  method to `IMonitorSource`.
- `src/runtime/adapters/hyprland_monitor_source.py` — parse the full payload;
  keep `detect_monitors()` as the name projection.
- `src/runtime/application/monitors.py` (or a new pure module) — filter/order.
- `src/runtime/cli/main.py` — `monitors` Typer group + `list` using
  `_OUTPUT_FORMAT_OPTION` and `CustomView`.
- `contracts/schemas/monitors-list.schema.json` + tests.

## Evidence

`make gates` in the runtime worktree; a live JSON sample; a headless
`source: "unavailable"` sample; schema-validation test output.

## Dependencies

None. Blocks `REQ-011` and `OPS-007`.
