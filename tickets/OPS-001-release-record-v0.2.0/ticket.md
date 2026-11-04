---
id: OPS-001
title: "Correct the v0.2.0 release record (T1)"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Correct the v0.2.0 release record (T1)

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Docs-only correction of the release record for `v0.2.0`, per the
[release-record handoff](../EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md)
T1. No code, tag movement, new version or deployment-pin change.

1. Add the missing `## v0.2.0 — 2026-11-01` section to `CHANGELOG.md`, covering
   REQ-002 (bar shell/states), REQ-003 (selection-first flow + overlay),
   REQ-004 (recording lifecycle + HUD) and REQ-005 (palette.v1 roles), plus
   the verification limits that were still open at release.
2. Publish those notes on the existing annotated tag as the `v0.2.0` GitHub
   Release. The tag message stays unchanged (immutable tag).
3. Correct the `dotfiles-v3` `0.6.21` composition entry: the 1123×54
   measurement was the new-code S1 lane before/after REQ-005, not
   `v0.1.0`-vs-`v0.2.0`; v0.2.0 is the bar redesign (centred panel → 142×54
   resting rail).
4. Replace the live 2026-10-31 freeze in EPIC-001 with a visible
   "freeze superseded by v0.2.0" record, keep the original decision quote,
   link the open debt, and update `tickets/INDEX.md` in the same commit.
5. Run the capture and composition gates; record the results below.

## Done-when

`main` carries the full `v0.2.0` changelog; the `v0.2.0` GitHub Release exists;
the composition entry no longer claims version-level geometry parity; the
freeze is marked superseded (not deleted); no `v0.2.1` tag and no deployed-pin
change; both gate sets exit 0.

## Evidence

| Claim | Command / artifact | Observed |
|---|---|---|
| changelog commit | `git show --stat 6286fc1` | `CHANGELOG.md` +94/−5; push `56f2b6d..6286fc1` on `main` |
| freeze/INDEX commit | `git show --stat 152182d` | `tickets/EPIC-001-capture-bar-redesign/ticket.md` + `tickets/INDEX.md`; push `6286fc1..152182d` on `main` |
| GitHub Release | `gh release view v0.2.0 -R RandomGenericUsername/ags-capture-tool` | `isDraft: false`, `isPrerelease: false`, title `v0.2.0 — Capture bar redesign + palette roles`, URL <https://github.com/RandomGenericUsername/ags-capture-tool/releases/tag/v0.2.0> |
| tag unchanged | `git rev-parse v0.2.0`; `git cat-file -p v0.2.0 \| head` | annotated object `0696bff2…` → commit `1897607…`; message still `v0.2.0 — CSS on palette.v1 roles (REQ-005)` |
| no new tag | `git tag -l` | exactly `v0.1.0`, `v0.2.0` |
| composition correction | `dotfiles-v3` commit `c12d9edc` | `0.6.21` capture bullet states the S1-lane scope and the centred-panel → 142×54 rail redesign |
| deployment pin untouched | `~/.local/share/dotfiles/apps/capture/pinned` | `v0.2.0` (not changed by this task) |
| `make test` | repo root | exit 0; 10/10 unit, 1/1 theme-validation, 297/297 TS; test `tsc` clean |
| `make conformance` | repo root | exit 0; 16/16 |
| `make backend` | repo root | exit 0; `114 passed` |
| `make typecheck` | repo root | exit 0; `OK: 0 errors in the ags-capture-tool tree` (28 tolerated third-party) |
| `dotfiles-v3 make gates` | `dotfiles-v3` repo root | exit 0; ansible-embedded-template-lint, deploy-coverage, ci-gates-parity, per-app-drift-symbol-suites all PASS |

## Follow-ups (not done by T1)

- **T2 — verification debt:** produce the pending-selection clip (FR-10), the
  HUD `hidden` vs `always` clips, and the `scale≠1` geometry evidence (JD
  decision: temporarily set `eDP-1` to 1.25, one region pick, restore 1.0);
  tick the corresponding boxes only with artifacts.
- **T3 — ticket-state reconciliation:** align frontmatter, INDEX and reality
  for EPIC-001, REQ-003 and REQ-004; close EPIC-001 only when all children
  and acceptance genuinely close.
- **T4/T5** remain as described in the handoff: refinement intake with JD and
  optional cleanup after T1–T3.

## Closeout

Closed 2026-11-04. `ags-capture-tool` `main` carries `6286fc1` (changelog +
release notes) and `152182d` (freeze superseded + INDEX); the `v0.2.0` GitHub
Release is published; `dotfiles-v3` carries `c12d9edc` (0.6.21 correction).
T2 and T3 are open and are not claimed by this closeout.
