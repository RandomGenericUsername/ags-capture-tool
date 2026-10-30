---
id: EPIC-001
title: "Capture bar redesign — state-driven minimalist bar"
kind: epic
status: proposed
lane: bmad-advisory
links:
  openspec: none
  bmad: none
worktree: none
branch: none
children: [REQ-002, REQ-003, REQ-004]
done-when: "Bar, selection-first flow and recording lifecycle all ship per design.md; every child requirement done with its acceptance checklist ticked."
---

# Capture bar redesign — state-driven minimalist bar

## Done-when

All three child requirements are `done` and the composition holds: the capture
tool's GUI is a state-driven minimalist bar (not a three-page panel) that keeps
every existing capability, adds the selection-first capture flow with an
irreversible commit, and preserves the live palette-refresh and identity
contracts. UX frame of reference: `design.md` (this ticket) plus
`mockups/capture-bar-mockups.html`.

## Context

Emerged from a UX session (2026-10-30, Sally/BMAD + JD). The prior
three-page panel (ui/classic: Screenshot/Recording/Settings pages) is replaced
by a five-state bar machine S0–S4. Full normative spec, decision log and
rejected alternatives live in [design.md](./design.md).

## Children

- [ ] `REQ-002` — Capture bar shell: five-state S0–S4, placement + on-demand pills (`proposed`)
- [ ] `REQ-003` — Selection-first capture flow: pending protocol + irreversible commit (`proposed`)
- [ ] `REQ-004` — Recording lifecycle: red accent + live HUD (`proposed`)
