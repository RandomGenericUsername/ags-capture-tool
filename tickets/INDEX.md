# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

- [EPIC-001-capture-bar-redesign/ticket.md](./EPIC-001-capture-bar-redesign/ticket.md) — Capture bar redesign — state-driven minimalist bar | `proposed` | 0/3 children done | done-when: bar + selection-first flow + recording lifecycle per `design.md`, all children done and acceptance ticked
  - [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement + on-demand pills (`proposed`)
  - [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit (`proposed`)
  - [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD (`proposed`)

## Requirements

- [REQ-001-migrate-capture-tool/ticket.md](./REQ-001-migrate-capture-tool/ticket.md) — Migrate capture-tool to standalone ags-capture-tool with live refresh | `done` | links: worktree none, branch main
- [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement, on-demand pills | `proposed` | links: openspec none, bmad none
- [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit | `proposed` | links: openspec none, bmad none
- [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD | `proposed` | links: openspec none, bmad none

## Bugs

(none)

## Ops tasks

(none)

## Spikes

(none)

## Tasks

(none)

## Done (links only, newest last)

(none)
