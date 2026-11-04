---
id: EPIC-002
title: "Shared monitor catalog + capture dropdown UI"
kind: epic
status: in-progress
lane: 4 — bmad-advisory
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
children: [REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, OPS-008, OPS-007]
done-when: "All children done; the mockup parity harness is green; live evidence is recorded; runtime v0.6.0 and capture v0.4.0 are tagged and pinned in dotfiles-v3; no open deviation from the EPIC-002 mockup."
---

# Shared monitor catalog + capture dropdown UI

Normative design: [design.md](./design.md).
Normative mockup: [mockups/capture-tool-dropdowns.html](./mockups/capture-tool-dropdowns.html)
(sha256 `a3f8cb4883b342dd902d231a9a4f79381e5a104b0b099123f6fcb3f5755e02df`).
Agent brief: [agent-brief.md](./agent-brief.md).

## Done-when

The capture bar shows one field trigger per setting (active value only, options in
a popover); the Monitor field is a dynamic dropdown populated from the shared
runtime monitor catalog; the settings panel no longer duplicates bar defaults;
the mockup parity test passes; live evidence covers every state; runtime and
capture releases are tagged and the composition pins are updated.

## Context

Emerged from the 2026-11-04 UX proposal and the user's monitor-catalog
requirement. Baseline: capture `v0.3.1`, platform `v0.5.0`, bar `v0.3.0`,
runtime `v0.5.2`, provision `v0.1.33`, composition `f84dc204`.

## Children

- [ ] `REQ-008` — Shared monitor catalog service (`dotfiles-runtime` + capture consumer contract)
- [ ] `REQ-009` — Dropdown primitive + screenshot lane
- [ ] `REQ-010` — Recording lane dropdowns + conditional states
- [ ] `REQ-011` — Dynamic monitor dropdown + remove cycle chip
- [ ] `REQ-012` — Settings cleanup + persistence
- [ ] `REQ-013` — Mockup parity harness
- [ ] `OPS-008` — Documentation reconciliation
- [ ] `OPS-007` — Release and pins
