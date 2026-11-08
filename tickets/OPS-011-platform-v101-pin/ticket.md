---
id: OPS-011
title: "Bump the local ags-platform pin to v1.0.1"
kind: ops-task
status: done
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
- Local `ags-platform` `v1.0.1` tag object `ba5ca4a2`, peeled commit `10b4d11`;
  `contracts` `v0.8.0` tag object `d86c19c8`, peeled commit `8906f1ad`.
- Gates command (foreground, worktree root):

  ```sh
  AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
  CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
  ```

  `PASS`:
  - `make test` unit `10/10`, validation `2/2`, TS suites `404/404`,
    `tsc --noEmit -p tests/tsconfig.tests.json` 0 errors.
  - `make conformance` `17/17` (including the v1.0.1 / v0.8.0 pin test).
  - `make backend` `114 passed`.
  - `make bundle` `build/capture.js` 2,118,400 bytes.
  - `make typecheck` 0 errors in the ags-capture-tool tree; 28 tolerated
    `/usr/share/ags/js` errors, 0 tolerated `ags-platform` errors.
- Log: `/tmp/opencode/ops-011-gates.log`.
- No app/backend/overlay source, handler/ack, `style.css` or lane-policy file is
  in the change set.
