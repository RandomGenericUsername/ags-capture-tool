---
id: OPS-010
title: "Refresh the EPIC-002 status note after runtime v0.6.1"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-010/
branch: ticket/OPS-010-runtime-v061-note
---

# Refresh the EPIC-002 status note after runtime v0.6.1

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

The OPS-009 status header named runtime `v0.6.0`. Applying the host exposed that
`v0.6.0` shipped version metadata `0.5.2`, so runtime `v0.6.1` was released
(runtime `BUG-009`) and pinned in `dotfiles-v3` (`PIN-0142`). Update the EPIC-002
design status line to name the shipped `v0.6.1`.

## Done-when

`tickets/EPIC-002-monitor-catalog-dropdowns/design.md` names runtime `v0.6.1`
and capture `v0.4.0` as the shipped tags.

## Evidence

- `tickets/EPIC-002-monitor-catalog-dropdowns/design.md` status header.
- Runtime `v0.6.1` tag `b4c9f77`; `dotfiles-runtime version` → `0.6.1` on the
  installed host.
- `dotfiles-v3` pin `882678b3`, master merge `bc5378a2`.
