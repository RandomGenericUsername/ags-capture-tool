---
id: OPS-012
title: "Bump the program tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-012/
branch: ticket/OPS-012-program-tuple-v110-v0120
---

# Bump the program tuple to ags-platform v1.1.0 / contracts v0.12.0

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Move the dev pin from `ags-platform` `v1.0.1` / `contracts` `v0.8.0` to
`ags-platform` `v1.1.0` / `contracts` `v0.12.0`. `v1.1.0` adds the required
`surface.window` outer/toplevel role and the `opacity` token kind; `v0.12.0`
ships the same required window group in the appearance schemas and fixtures.
The exported API, generation-bound `appearance-refresh` protocol and handler
behavior are unchanged, and the downstream audit says apps that only call
`value(...)` need no code change — this is a pin-parity wave only.

Update every pin consumer in this repo:

- `Makefile`: `AGS_PLATFORM_VERSION`, `CONTRACTS_VERSION`, comments and the
  help/symlink text.
- `.github/workflows/ci.yml`: the checkout `ref`s, paths and the tuple comment.
- `tests/app-contract.test.mjs`: the pin assertion and test names.
- `README.md`: appearance-plane, local-dev tuple and symlink path.
- `CHANGELOG.md`: the v0.7.2 release entry.

Out of scope: app/backend/overlay code, handler/ack behavior, `style.css`,
lane policy and the frozen `templates/ags-app/` copy.

## Done-when

The repo pins `ags-platform` `v1.1.0` / `contracts` `v0.12.0` everywhere, the
pin test asserts both tags, `make gates` is green and `v0.7.2` is tagged.

## Evidence

- `Makefile:9-10` → `AGS_PLATFORM_VERSION := v1.1.0`,
  `CONTRACTS_VERSION := v0.12.0`; help text names the same tuple.
- `.github/workflows/ci.yml:31-36` checks out `ref: v1.1.0` at
  `.dev/ags-platform/v1.1.0` and `ref: v0.12.0` for `contracts`.
- `tests/app-contract.test.mjs:253,272` names the v0.12.0 schema and asserts
  `v1\\.1\\.0` / `v0\\.12\\.0`.
- `README.md:51-52,104-110` names the `v1.1.0` / `v0.12.0` tuple and the
  `.dev/ags-platform/v1.1.0` symlink path.
- Commits: ticket `8f0fce2`, pin `5ed83b4`, release `7c0a881`.
- Local `ags-platform` `v1.1.0` tag object `c1fc73d7`, peeled commit `f20a685`;
  `contracts` `v0.12.0` tag object `b5435739`, peeled commit `a03b563`.
- Gates command (foreground, worktree root):

  ```sh
  AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
  CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make gates
  ```

  `PASS`:
  - `make test` unit `10/10`, validation `2/2`, TS suites `404/404`,
    `tsc --noEmit -p tests/tsconfig.tests.json` 0 errors.
  - `make conformance` `17/17` (including the v1.1.0 / v0.12.0 pin test).
  - `make backend` `114 passed`.
  - `make bundle` `build/capture.js` 2,121,408 bytes.
  - `make typecheck` 0 errors in the ags-capture-tool tree; 28 tolerated
    `/usr/share/ags/js` errors, 0 tolerated `ags-platform` errors.
- Log: `/tmp/opencode/ops-012-gates.log`.
- No app/backend/overlay source, handler/ack, `style.css`, lane-policy or
  `templates/ags-app/` file is in the change set.
