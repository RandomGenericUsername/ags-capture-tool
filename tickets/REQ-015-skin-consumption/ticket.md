---
id: REQ-015
title: "Consume the app-scoped skin plane"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-015/
branch: ticket/REQ-015-skin-consumption
---

# Consume the app-scoped skin plane

## Requirement

Consume the platform `v0.8.0` app-scoped Skin adapter so the runtime-expanded
`$XDG_CONFIG_HOME/ags-capture/skin.css` overlays the bundled `style.css` glass
fallback at USER priority. The existing palette-refresh handler, the window
structure and every class, gesture, size and behavior stay unchanged.

## Acceptance

- [ ] `app.tsx` builds one module-level `createAppSkin({ configDir:
  "ags-capture" })` and calls `skin.apply()` immediately after `theme.apply()`
  in `main()`.
- [ ] The existing palette-refresh handler is unchanged; no skin-refresh
  request handler is added (the adapter's monitor reloads `skin.css`).
- [ ] `style.css` remains the bundled glass fallback, including its local
  `--rec-accent` recording mechanism.
- [ ] No structure/class/gesture/size/behavior change; layout tokens remain
  TSX-owned and none are consumed in v1.
- [ ] The Makefile pins platform `v0.8.0` / contracts `v0.6.0`.
- [ ] A source-level validation test proves the theme-then-skin order, the
  `ags-capture` config directory, the absence of a new request handler and the
  presence of `style.css`.
- [ ] `make gates` passes with `AGS_PLATFORM_DEV` / `CONTRACTS_ROOT` overrides.
