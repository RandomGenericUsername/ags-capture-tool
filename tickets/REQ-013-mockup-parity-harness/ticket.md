---
id: REQ-013
title: "Mockup parity harness"
kind: requirement
status: proposed
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-009, REQ-010, REQ-011, REQ-012]
blocks: [OPS-008, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
mockup-sha256: a3f8cb4883b342dd902d231a9a4f79381e5a104b0b099123f6fcb3f5755e02df
---

# Mockup parity harness

## Requirement

Make drift from the normative mockup a test failure.

## Acceptance

- [ ] `tests/ts/mockup-parity.test.ts` reads the mockup `design-contract` block
  and compares lane order/defaults/keys/descriptions/options, monitor shape,
  settings groups/rows/recording controls, required CSS classes and the mockup
  hash.
- [ ] The test fails if any one side changes without the other.
- [ ] The mockup's own validator shows no drift banner.
- [ ] `make test` includes the parity test and passes.
- [ ] The ticket records the mockup hash and exact command output.

## Implementation map

- `tests/ts/mockup-parity.test.ts`
- `ui/shared/field-defs.ts`, `ui/shared/settings-defs.ts`
- `style.css` required-class/token assertions

## Evidence

`make test` output; a deliberate one-side mutation proving the test fails, then
restored.
