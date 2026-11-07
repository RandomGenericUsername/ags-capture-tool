---
id: REQ-018
title: "Consume Generations v3 and the appearance-refresh protocol"
kind: requirement
status: in-progress
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

- [ ] The Makefile, CI workflow and pin test name `ags-platform` `v1.0.0` /
      `contracts` `v0.8.0`.
- [ ] `app.tsx` keeps one
      `createAppearance({ configDir: "ags-capture" })`, one
      `appearance.apply()` in `main()` and the
      `createAppearanceRefreshHandler(appearance, work)` wiring; `work` returns
      the v3 applied result after `refreshAppAppearance()`.
- [ ] The combined capture request dispatcher routes the v3
      `appearance-refresh` command to that handler and still routes
      `capture-cluster` unchanged.
- [ ] The source tests assert the v3 command and response union
      (`applied` / `deferred` / `failed` with the requested `genHash`), not the
      retired `palette-refresh` boolean ack.
- [ ] `style.css`, the Python backend and the overlay sources are unchanged.
- [ ] `make gates` passes on the branch with the local overrides
      `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
      `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.
- [ ] The branch fast-forwards to `main`, the next minor tag `v0.7.0` is
      created, and `main` plus the tag are pushed to `origin`.
