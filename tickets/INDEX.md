# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

- [EPIC-001-capture-bar-redesign/ticket.md](./EPIC-001-capture-bar-redesign/ticket.md) — Capture bar redesign — state-driven minimalist bar | `in-progress` (frozen 2026-10-31) | 2/3 children done | done-when: bar + selection-first flow + recording lifecycle per `design.md`, all children done and acceptance ticked
  - [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement + on-demand pills (`done`)
  - [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit (`in-progress`)
  - [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD (`done`)

## Requirements

- [REQ-001-migrate-capture-tool/ticket.md](./REQ-001-migrate-capture-tool/ticket.md) — Migrate capture-tool to standalone ags-capture-tool with live refresh | `done` | links: worktree none, branch main
- [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement, on-demand pills | `done` | links: worktree .worktrees/REQ-002/, branch ticket/REQ-002-capture-bar-shell
- [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit | `in-progress` | links: worktree .worktrees/REQ-003/, branch ticket/REQ-003-selection-first-flow
- [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD | `in-progress` | links: worktree .worktrees/REQ-004/, branch ticket/REQ-004-recording-lifecycle
- [REQ-005-theme-roles/ticket.md](./REQ-005-theme-roles/ticket.md) — Migrate capture CSS to semantic palette.v1 roles | `done` | links: worktree .worktrees/REQ-005/, branch ticket/REQ-005-theme-roles

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
