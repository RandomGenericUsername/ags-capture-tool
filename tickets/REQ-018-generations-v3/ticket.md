---
id: REQ-018
title: "Consume Generations v3 and the appearance-refresh protocol"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-018/
branch: ticket/REQ-018-generations-v3
---

# Consume Generations v3 and the appearance-refresh protocol

## Requirement

Generations v3 freezes the state-only appearance plane and replaces the v2
`palette-refresh <appearance-hash>` boolean ack with the generation-bound
`appearance-refresh <genHash>` protocol.

The capture app must pin `ags-platform` `v1.0.0` / `contracts` `v0.8.0`, route
`appearance-refresh` through the combined capture request handler, and let
`createAppearanceRefreshHandler(appearance, work)` resolve the requested
generation before the app-owned icon/window work runs. The app keeps its one
`createAppearance({ configDir: "ags-capture" })` and its single
`appearance.apply()` in `main()`. `style.css`, the Python backend and the
overlays are unchanged.

## Acceptance

- [x] The Makefile, CI workflow and pin test name `ags-platform` `v1.0.0` /
      `contracts` `v0.8.0`.
- [x] `app.tsx` keeps one
      `createAppearance({ configDir: "ags-capture" })`, one
      `appearance.apply()` in `main()` and the
      `createAppearanceRefreshHandler(appearance, work)` wiring; `work` returns
      the v3 applied result after `refreshAppAppearance()`.
- [x] The combined capture request dispatcher routes the v3
      `appearance-refresh` command to that handler and still routes
      `capture-cluster` unchanged.
- [x] The source tests assert the v3 command and response union
      (`applied` / `deferred` / `failed` with the requested `genHash`), not the
      retired `palette-refresh` boolean ack.
- [x] `style.css`, the Python backend and the overlay sources are unchanged.
- [x] `make gates` passes on the branch with the local overrides
      `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
      `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.
- [x] The branch fast-forwards to `main`, the next minor tag `v0.7.0` is
      created, and `main` plus the tag are pushed to `origin`.

## Implementation

- `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v1.0.0` and
  `CONTRACTS_VERSION := v0.8.0`; `.github/workflows/ci.yml:30-35` checks out
  the same tags. `tests/app-contract.test.mjs` pins the tuple.
- `app.tsx:46` keeps exactly one
  `createAppearance({ configDir: "ags-capture" })`; `app.tsx:114` keeps the
  single `appearance.apply()` in `main()`; `app.tsx:63-66` wires
  `createAppearanceRefreshHandler(appearance, work)`, where `work` runs
  `refreshAppAppearance()` and returns `{ status: "applied" }` (v1.0.0 rejects
  a void work result).
- `lib/request-dispatch.ts` imports `APPEARANCE_REFRESH_COMMAND` and
  `AppearanceRefreshRequestHandler` from
  `ags-platform/ports/appearance-refresh`, routes only that command to the v3
  helper, and leaves `capture-cluster` unchanged.
- `README.md` and `AGENTS.md` describe the state-only
  `current/manifest.json` + `current/appearance/ags-capture.css` read and the
  `appearance-refresh <genHash>` response union.
- `tests/unit.test.mjs`, `tests/ts/state-preservation.test.ts` and
  `tests/ts/request-dispatch.test.ts` execute the v3 command and response
  union, including deferred generation, malformed request, retired command and
  in-flight `deferred:"busy"` cases. `tests/validation/appearance-migration.test.mjs`
  pins the v3 dispatcher and rejects the old command.

## Evidence

### Source checks

- `rg -n "palette-refresh|PALETTE_REFRESH|createPaletteRefresh" app.tsx lib ui`
  returns no production matches (exit 1). The only remaining references in the
  app tests are negative assertions that the retired command is rejected.
- `git diff --stat 4cc04d4..HEAD -- style.css bin tests/python ui/overlay` is
  empty; `style.css`, the Python backend and the overlay sources are
  byte-unchanged.
- `git -C /home/inumaki/Development/dotfiles/ags-platform describe --tags
  --exact-match` → `v1.0.0`; the same command in
  `/home/inumaki/Development/dotfiles/contracts` → `v0.8.0`.
- `git diff 4cc04d4..HEAD -- app.tsx lib/request-dispatch.ts` shows the v3
  command routing, the applied-result work and no window/overlay change.

### Gates

Command (worktree `.worktrees/REQ-018/`, branch
`ticket/REQ-018-generations-v3`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: exit 0. Full log: `/tmp/opencode/req018-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/unit.test.mjs` | 10/10 pass |
| `make test` — `tests/validation` | 2/2 pass |
| `make test` — `tests/ts` | 404/404 pass |
| `make test` — test-program `tsc` | 0 errors |
| `make conformance` | 17/17 pass, including the v1.0.0 / v0.8.0 pin assertion |
| `make backend` | 114/114 pass |
| `make bundle` | `build/capture.js`, 2,115,328 bytes |
| `make typecheck` | 0 errors in the ags-capture-tool tree; 28 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

Local platform checkout: `/home/inumaki/Development/dotfiles/ags-platform`
(`v1.0.0`); contracts `/home/inumaki/Development/dotfiles/contracts`
(`v0.8.0`).

## Release and merge

- Planning commit: `86bda1d` — `tickets: file REQ-018 generations v3`.
- Pin commit: `83732aa` —
  `chore(REQ-018): pin platform v1.0.0 / contracts v0.8.0`.
- Implementation commit: `8d0ed9c` —
  `feat(REQ-018): adopt generation-bound appearance-refresh`.
- Test commit: `55d4ef5` —
  `test(REQ-018): pin the v3 appearance-refresh protocol`.
- Release-note commit: `557cc17` —
  `chore(release): ags-capture-tool v0.7.0`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.7.0`, the next minor after `v0.6.1`.
- `main` and the `v0.7.0` tag are pushed to `origin`; no existing tag is moved.

## Deviations

- None in app behavior. The handler variable was renamed from `paletteRefresh`
  to `appearanceRefresh`, and the v1.0.0 work callback now returns
  `{ status: "applied" }`; both are required to name and complete the v3
  protocol. The frozen `templates/ags-app` scaffold is outside this app's
  runtime and was left untouched.
