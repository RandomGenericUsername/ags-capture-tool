# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

- [EPIC-001-capture-bar-redesign/ticket.md](./EPIC-001-capture-bar-redesign/ticket.md) — Capture bar redesign — state-driven minimalist bar | `done` | 3/3 children done | done-when: bar + selection-first flow + recording lifecycle per `design.md`, all children done and acceptance ticked
  - [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement + on-demand pills (`done`)
  - [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit (`done`)
  - [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD (`done`)

## Requirements

- [REQ-001-migrate-capture-tool/ticket.md](./REQ-001-migrate-capture-tool/ticket.md) — Migrate capture-tool to standalone ags-capture-tool with live refresh | `done` | links: worktree none, branch main
- [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement, on-demand pills | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-005-theme-roles/ticket.md](./REQ-005-theme-roles/ticket.md) — Migrate capture CSS to semantic palette.v1 roles | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)

## Bugs

- [BUG-001-settings-transparency/ticket.md](./BUG-001-settings-transparency/ticket.md) — Settings panel has no card background and is unreadable over the window behind (C17) | `done` | severity high | lane direct, worktree .worktrees/BUG-FIX/, branch ticket/BUG-FIX-capture-bugs | fixed 2445d44; live v0.2.1 verified 2026-11-04 (`/tmp/opencode/capture-verify-v021/EVIDENCE.md`); JD live-confirmed good 2026-11-04
- [BUG-002-small-region-move/ticket.md](./BUG-002-small-region-move/ticket.md) — Minimal-size region resizes instead of moving when dragged from its centre (C5) | `done` | severity medium | lane direct, worktree .worktrees/BUG-FIX/, branch ticket/BUG-FIX-capture-bugs | fixed 2445d44; live v0.2.1 verified 2026-11-04 (`/tmp/opencode/capture-verify-v021/EVIDENCE.md`); JD live-confirmed at ~30px, accepted at ≥30px 2026-11-04 (minimal-size drag not pursued)

## Ops tasks

- [OPS-001-release-record-v0.2.0/ticket.md](./OPS-001-release-record-v0.2.0/ticket.md) — Correct the v0.2.0 release record (T1) | `done` | worktree none, branch main | release: v0.2.0 notes corrected 2026-11-04
- [OPS-002-verification-proof/ticket.md](./OPS-002-verification-proof/ticket.md) — Close capture v0.2.0 verification debt (T2): overlay/HUD clips, additive flags, scale≠1 | `done` | worktree none, branch main | evidence: `/tmp/opencode/capture-t2/EVIDENCE.md`
- [OPS-003-reconcile-ticket-state/ticket.md](./OPS-003-reconcile-ticket-state/ticket.md) — Reconcile capture v0.2.0 ticket state (T3): EPIC-001/REQ-003/REQ-004 + INDEX | `done` | worktree none, branch main | EPIC-001 closed 3/3 children 2026-11-04
- [OPS-004-cleanup/ticket.md](./OPS-004-cleanup/ticket.md) — Remove merged REQ-002..005 worktrees/branches and installed v0.1.0 (T5) | `done` | worktree none, branch main | v0.1.0 tag retained as rollback record
- [OPS-005-t4-refinement-intake/ticket.md](./OPS-005-t4-refinement-intake/ticket.md) — Refinement intake for capture v0.2.0 (T4): JD live pass recorded; C5+C17 confirmed, deferred list recorded | `done` | worktree none, branch main | filed BUG-001/BUG-002; v0.2.1 retest closed both and JD live-confirmed them; C3 is expected hover behaviour, positive path verified reachable on probe (no BUG-003); 3 not-bug, 1 accepted, 10 deferred

## Spikes

- [SPIKE-001-hover-region/ticket.md](./SPIKE-001-hover-region/ticket.md) — Widen the S4 hover reveal region during recording | `reported` | timebox 2h | recommendation: pointer-poll reveal (C); JD decision pending

## Tasks

(none)

## Done (links only, newest last)

(none)
