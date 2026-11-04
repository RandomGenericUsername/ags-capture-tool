---
id: OPS-003
title: "Reconcile capture v0.2.0 ticket state (T3)"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Reconcile capture v0.2.0 ticket state (T3)

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Docs-only reconciliation of the ticket record after T1 (release record) and T2
(verification), per the [release-record handoff](../EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md)
T3. No app code, tag, or deployed-pin change.

1. `REQ-003` → `done`: all acceptance boxes were ticked by T2, including the
   overlay-never-captured clip and additive backend flags.
2. `REQ-004` → `done`: frontmatter was already `done`; the INDEX line said
   `in-progress` and is corrected.
3. `EPIC-001` → `done`: all three children are `done` and every child
   acceptance box is ticked, so the epic `done-when` holds.
4. `tickets/INDEX.md`: epic is `done` / `3/3 children done`; the stale
   `frozen` wording is removed while the freeze-superseded record in the epic
   is kept intact.
5. T2 evidence (clip paths, `/tmp/opencode/capture-t2/EVIDENCE.md`, OPS-002)
   is linked from the epic and requirement tickets.
6. Merged worktree/branch links are retired (`worktree: none`, `branch: main`)
   for REQ-002..REQ-005 because their contents are ancestors of `main`; the
   directories themselves are left for T5.
7. Ownership is recorded: T1 = OPS-001, T2 = OPS-002, T3 = OPS-003.

## Done-when

EPIC-001, REQ-003 and REQ-004 frontmatter, INDEX line and reality agree;
EPIC-001 is `done` only because all children and acceptance are closed; the
T2 evidence and scale caveat are recorded; the capture gates exit 0.

## Ownership record

| Task | Ticket | Status | Scope |
|---|---|---|---|
| T1 | [OPS-001](../OPS-001-release-record-v0.2.0/ticket.md) | `done` | v0.2.0 changelog, GitHub Release, composition correction, freeze superseded |
| T2 | [OPS-002](../OPS-002-verification-proof/ticket.md) | `done` | overlay/HUD clips, additive backend flags, positive-origin scale 1.25 pick |
| T3 | this ticket | `done` | EPIC-001/REQ-003/REQ-004 status + INDEX reconciliation, T5-deferred links |

## Evidence

| Claim | Command / artifact | Observed |
|---|---|---|
| Reconciliation commit | `git show --stat ee7aab1` | 9 files changed (+172/−38); `OPS-003` created; no code paths touched |
| No unchecked child acceptance | `grep -rn '^- \[ \]' tickets/REQ-002-capture-bar-shell tickets/REQ-003-selection-first-flow tickets/REQ-004-recording-lifecycle tickets/REQ-005-theme-roles` | no matches |
| EPIC rollup | `grep -c '^- \[x\] ' tickets/EPIC-001-capture-bar-redesign/ticket.md` | `3` = `children: [REQ-002, REQ-003, REQ-004]` |
| REQ-003 status | `sed -n '1,12p' tickets/REQ-003-selection-first-flow/ticket.md` | `status: done` |
| REQ-004 status | `sed -n '1,12p' tickets/REQ-004-recording-lifecycle/ticket.md` | `status: done` |
| EPIC status / INDEX | `sed -n '1,8p' tickets/EPIC-001-capture-bar-redesign/ticket.md`; `tickets/INDEX.md` | `status: done`; INDEX `done` / `3/3 children done` |
| Branch content on main | `git merge-base --is-ancestor ticket/REQ-00N… HEAD` | REQ-002..REQ-005 all merged |
| T2 evidence | `/tmp/opencode/capture-t2/EVIDENCE.md`; [OPS-002 evidence](../OPS-002-verification-proof/evidence.md) | clips, frames and backend logs present |
| `make test` | repo root | exit 0; `tests 10 / pass 10`, `tests 1 / pass 1`, `tests 297 / pass 297`; test `tsc` clean |
| `make conformance` | repo root | exit 0; `tests 16 / pass 16` |
| `make backend` | repo root | exit 0; `114 passed` |
| `make typecheck` | repo root | exit 0; `OK: 0 errors in the ags-capture-tool tree` |

## Follow-ups

- **T4** (refinement intake with JD) remains open; no behaviour fixes were
  folded into this record task.
- **T5** (optional cleanup) still removes `.worktrees/REQ-002..005` and the
  installed `v0.1.0` directory. The branch links are already retired here
  because all four branches are merged into `main`.
