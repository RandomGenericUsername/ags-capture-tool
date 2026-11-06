---
id: REQ-015
title: "Consume the app-scoped skin plane"
kind: requirement
status: done
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

- [x] `app.tsx` builds one module-level `createAppSkin({ configDir:
  "ags-capture" })` and calls `skin.apply()` immediately after `theme.apply()`
  in `main()`.
- [x] The existing palette-refresh handler is unchanged; no skin-refresh
  request handler is added (the adapter's monitor reloads `skin.css`).
- [x] `style.css` remains the bundled glass fallback, including its local
  `--rec-accent` recording mechanism.
- [x] No structure/class/gesture/size/behavior change; layout tokens remain
  TSX-owned and none are consumed in v1.
- [x] The Makefile pins platform `v0.8.0` / contracts `v0.6.0`.
- [x] A source-level validation test proves the theme-then-skin order, the
  `ags-capture` config directory, the absence of a new request handler and the
  presence of `style.css`.
- [x] `make gates` passes with `AGS_PLATFORM_DEV` / `CONTRACTS_ROOT` overrides.

## Evidence

- Wiring: `app.tsx:9` imports `createAppSkin`; `app.tsx:60-64` builds the one
  module-level `createAppSkin({ configDir: "ags-capture" })`;
  `app.tsx:110-115` calls `skin.apply()` immediately after `theme.apply()` in
  `main()`.
- Existing refresh lane: `app.tsx:55-58` keeps the palette-refresh handler
  (`theme.apply()` + `refreshAppAppearance()`); `app.tsx:72-77` keeps the one
  `createCaptureRequestHandler(paletteRefresh, ...)` registration. No
  skin-refresh command was added.
- Fallback: `style.css` is still present (28,979 bytes), still imported at
  `app.tsx:4` and installed at `app.tsx:107`, and still carries
  `--rec-accent: @error`.
- Pins: `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v0.8.0` and
  `CONTRACTS_VERSION := v0.6.0`; `README.md` local-dev tuple and the CI checkout
  tags match.
- Test: `tests/validation/skin-consumption.test.mjs:93-150` asserts the
  import, the module-level `ags-capture` config, theme-then-skin order, the one
  existing request handler, no skin-refresh request, `style.css` presence /
  `--rec-accent` and no layout-token accessor.
- Commits: `d60d246` ticket, `def1b99` wiring, `868f07b` pins, `aa50bdb`
  validation test, `42be0fc` v0.5.0 changelog.
- Gates (from `.worktrees/REQ-015`, with
  `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
  `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`):

```sh
make gates
# test: 10/10 unit, 2/2 validation, 403/403 TypeScript, test tsc clean
# conformance: 17/17
# backend: 114 passed
# bundle: OK build/capture.js (2,080,096 bytes)
# typecheck: OK, 0 errors in the ags-capture-tool tree
#            (28 tolerated AGS-runtime errors, 0 ags-platform)
```

- Tag: `v0.5.0` (annotated) after the fast-forward merge to `main`.
