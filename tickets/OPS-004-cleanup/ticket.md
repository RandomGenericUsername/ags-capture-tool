---
id: OPS-004
title: "Remove merged worktrees/branches and installed v0.1.0 (T5)"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Remove merged worktrees/branches and installed v0.1.0 (T5)

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Optional cleanup after T1–T3, per the [release-record handoff](../EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md)
T5 and JD's Q3 decision (remove the installed `v0.1.0`). No app code,
deployed-pin, tag, or release change.

1. Verify each REQ-002..REQ-005 branch is an ancestor of `main` and each
   worktree is clean.
2. Confirm the live app is `v0.2.0` (`pinned`, config symlink, running PID).
3. Confirm the `v0.1.0` git tag exists and will remain the rollback record.
4. `git worktree remove` each worktree (no `--force`).
5. `git branch -d` each merged local branch (never `-D`).
6. Remove the installed `v0.1.0` app directory (JD decision, 2026-11-04).
7. `git worktree prune`; confirm only the main checkout remains.
8. Verify live after cleanup: capture running, `dotfiles-runtime doctor`
   exit 0, `ags list` still shows `capture`.

## Pre-checks (all passed before any removal)

| Item | Branch | Head | Ancestor of `main`? | Unmerged commits | Worktree status |
|---|---|---|---|---|---|
| `.worktrees/REQ-002` | `ticket/REQ-002-capture-bar-shell` | `e8b443f` | yes | 0 | clean |
| `.worktrees/REQ-003` | `ticket/REQ-003-selection-first-flow` | `b3c5c13` | yes | 0 | clean |
| `.worktrees/REQ-004` | `ticket/REQ-004-recording-lifecycle` | `d720c2b` | yes | 0 | clean |
| `.worktrees/REQ-005` | `ticket/REQ-005-theme-roles` | `1897607` | yes | 0 | clean |

Commands: `git merge-base --is-ancestor <branch> main`;
`git rev-list --count main..<branch>`; `git -C <worktree> status --porcelain`.

Live state before removal:

| Check | Command | Result |
|---|---|---|
| Pinned version | `cat ~/.local/share/dotfiles/apps/capture/pinned` | `v0.2.0` |
| Config target | `readlink -f ~/.config/ags-capture` | `.../apps/capture/v0.2.0` |
| Running process | `ps -o pid,lstart,cmd -p 511294` | PID `511294`, started `2026-11-04 10:04:48`, `ags run -d ~/.config/ags-capture` |
| Rollback tag | `git tag -n1 v0.1.0` | `v0.1.0  ags-capture-tool v0.1.0` |
| Desktop health | `dotfiles-runtime doctor` | `desktop clean: 21 item(s) checked; watch health: ok …`, exit 0 |

## Commands and results

```sh
# from /home/inumaki/Development/dotfiles/ags-capture-tool
git worktree remove .worktrees/REQ-002   # exit 0
git worktree remove .worktrees/REQ-003   # exit 0
git worktree remove .worktrees/REQ-004   # exit 0
git worktree remove .worktrees/REQ-005   # exit 0

git branch -d ticket/REQ-002-capture-bar-shell    # Deleted (was e8b443f), exit 0
git branch -d ticket/REQ-003-selection-first-flow # Deleted (was b3c5c13), exit 0
git branch -d ticket/REQ-004-recording-lifecycle  # Deleted (was d720c2b), exit 0
git branch -d ticket/REQ-005-theme-roles          # Deleted (was 1897607), exit 0

rm -rf -- /home/inumaki/.local/share/dotfiles/apps/capture/v0.1.0  # exit 0 (760K)
git worktree prune -v                                             # exit 0
```

No `--force` and no `-D` were used. None of the four branches existed on
`origin` (`git ls-remote --heads origin <branch>` → 0 matches), so there was
no remote branch to delete.

## Done-when

Only the main checkout appears in `git worktree list`; the four REQ branches
are gone; the installed `v0.1.0` directory is gone; `v0.2.0`, `pinned`, and the
`v0.1.0` git tag remain; live capture is still running and healthy.

## Evidence — after cleanup

| Claim | Command / artifact | Observed |
|---|---|---|
| Only main worktree | `git worktree list` | `/home/inumaki/Development/dotfiles/ags-capture-tool  <HEAD> [main]` |
| Only main branch | `git branch -vv` | `* main  <HEAD> [origin/main]` |
| Rollback tag retained | `git tag -n2` | `v0.1.0`, `v0.2.0` both present |
| `v0.1.0` app dir removed | `ls ~/.local/share/dotfiles/apps/capture/` | `.rollback/`, `pinned`, `v0.2.0/` only |
| `v0.2.0` retained | `cat .../apps/capture/v0.2.0/app.manifest.json` | `app=capture instance=capture configDir=ags-capture mode=live` |
| Pin unchanged | `cat .../apps/capture/pinned` | `v0.2.0` |
| Config unchanged | `readlink -f ~/.config/ags-capture` | `.../apps/capture/v0.2.0` |
| Capture still running | `ps -o pid,lstart,cmd -p 511294` | same PID `511294`, started `2026-11-04 10:04:48` |
| `ags` instance present | `ags list` | `ags`, `btop-theme-studio`, `capture`, `notifications`, `wallpaper-selector` |
| Doctor clean | `dotfiles-runtime doctor` | `desktop clean: 21 item(s) checked; watch health: ok …`, exit 0 |
| Runtime state | `dotfiles-runtime inspect status` | `desktop state: wallpaper 3ee7e7008656 …, 12 symlink(s) checked` |

## Intentionally left behind

- `~/.local/share/dotfiles/apps/capture/v0.2.0/` and `pinned` — the live app.
- `~/.local/share/dotfiles/apps/capture/.rollback/capture-ui` — a standalone
  rollback-launcher script (regular file, not a symlink into `v0.1.0`); not
  part of the removed app directory.
- Git tag `v0.1.0` — the immutable rollback record.
- Empty `.worktrees/` directory — harmless; no worktree metadata remains.
- **T4** (refinement intake with JD) remains open; no behaviour fixes were
  folded into this cleanup.

## Follow-ups

- None for T5. T4 is tracked separately in the handoff §4.
