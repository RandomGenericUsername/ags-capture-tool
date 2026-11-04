---
id: REQ-009
title: "Dropdown primitive + screenshot lane"
kind: requirement
status: proposed
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

- [ ] `ui/shared/field-defs.ts` is pure (no `ags/*`, no `gi://*`) and matches the
  mockup `design-contract` for the screenshot lane.
- [ ] `ui/shared/dropdown.ts` exposes `dropdownField()` and a handle with
  `setValue`, `setOptions`, `setEnabled`, `setVisible`, `open`, `close`,
  `isOpen`, `destroy`.
- [ ] S1 screenshot shows one trigger per field (Target, Monitor placeholder,
  Delay, Format, Output, Cursor); no side-by-side option group remains.
- [ ] Every old option is present in the correct popover; Cursor is
  `On — draw the pointer` / `Off — hide it` and persists through
  `settingsStore`.
- [ ] Enter commits when closed; Space/↓ opens; Esc closes the popover first;
  Enter in the popover selects; focus returns to the trigger.
- [ ] Opening/closing a popover does not call `syncWindowSize()`; Target change
  does.
- [ ] Screenshot lane width ≤ 700 px, measured and recorded.
- [ ] `make test`, `make conformance`, `make backend`, `make typecheck`,
  `make bundle` pass.
- [ ] Live evidence: `shot-closed.png`, `shot-cursor-open.png`.

## Implementation map

- `ui/shared/field-defs.ts`, `ui/shared/dropdown.ts`
- `ui/classic/ScreenshotPage.tsx`
- `ui/classic/ClassicWindow.tsx` — field handles, `activePopover`,
  `closeAllFields`, key deferral, `syncWindowSize`.
- `style.css` — `.field-*` classes; palette tokens only.

## Evidence

Gate output; measured width; live screenshots; source test that the popover
open path does not call `syncWindowSize`.
