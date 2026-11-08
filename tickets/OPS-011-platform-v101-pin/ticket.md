---
id: OPS-011
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-011/
branch: ticket/OPS-011-platform-v101-pin
---

# Bump the local ags-platform pin to v1.0.1

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Move the dev pin from `ags-platform` `v1.0.0` to `v1.0.1` and keep `contracts`
`v0.8.0`. `v1.0.1` is the platform's appearance CSS validation patch
(`BUG-002`): `validateAppearanceCss` no longer rejects CSS ID selectors such as
`window#notifications-window` or `url(#fragment)` references as hex colours.
The exported API, generation-bound `appearance-refresh` protocol and handler
behavior are unchanged.

Update every pin consumer in this repo:

- `Makefile`: `AGS_PLATFORM_VERSION`, comments and the help/symlink text.
- `.github/workflows/ci.yml`: the checkout `ref` and the tuple comment.
- `tests/app-contract.test.mjs`: the pin assertion and test name.
- `README.md`: appearance-plane, local-dev tuple and symlink path.
- `CHANGELOG.md`: the v0.7.1 release entry.

Out of scope: app/backend/overlay code, handler/ack behavior, `style.css`,
lane policy and `contracts` (stays `v0.8.0`).

## Done-when

The repo pins `ags-platform` `v1.0.1` / `contracts` `v0.8.0` everywhere, the
pin test asserts `v1.0.1`, and `make gates` is green.

## Evidence

- `Makefile:8-9` → `AGS_PLATFORM_VERSION := v1.0.1`, `CONTRACTS_VERSION := v0.8.0`.
- `.github/workflows/ci.yml` checks out `ref: v1.0.1` for `ags-platform` and
  `ref: v0.8.0` for `contracts`.
- `tests/app-contract.test.mjs` pin test asserts `v1\\.0\\.1`.
- Local `ags-platform` `v1.0.1` tag `10b4d11`; `contracts` `v0.8.0` unchanged.
