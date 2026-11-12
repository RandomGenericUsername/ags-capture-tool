---
id: OPS-012
title: "Bump the program tuple to ags-platform v1.1.0 / contracts v0.12.0"
kind: ops-task
status: in-progress
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
