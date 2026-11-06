---
id: REQ-016
title: "Migrate the capture tool to the v2 Appearance plane"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-016/
branch: ticket/REQ-016-appearance-migration
---

# Migrate the capture tool to the v2 Appearance plane

## Requirement

Adopt the unified Appearance plane (contracts `v0.7.0`, `ags-platform`
`v0.9.0`) in the capture app. The runtime (`v0.9.1`) publishes palette, skin
and mode as one immutable generation behind the single repointed hop
`$XDG_STATE_HOME/dotfiles/current/appearance`; consumers watch that hop and
read `$XDG_CONFIG_HOME/<configDir>/appearance.css` plus its `tokens.json`.

`app.tsx` declares one module-level
`createAppearance({ configDir: "ags-capture" })` and `main()` calls
`appearance.apply()`. The split `theme.apply()` / `skin.apply()` startup is
removed, as are the v1 Theme/Skin imports.

The `palette-refresh` handler becomes
`createAppearanceRefreshHandler(appearance, work)`. The platform helper always
re-applies the whole appearance before the app-owned `work`; `work` keeps the
existing non-destructive `refreshAppAppearance()` fan-out and does not call
`theme.apply()` or `appearance.apply()`. The single capture request surface
(screenshot/record/settings handlers plus the existing `capture-cluster` lane)
stays unchanged; no new request command is added.

The capture panel width becomes the TSX-owned layout token
`appearance.value("layout.ags-capture.panel-width", 560)` instead of a hard
panel constant, read with `peek()` where a plain pixel number is required. The
`style.css` glass fallback, `--rec-accent`, selectors, class vocabulary,
gestures, geometry and behavior do not change. The Python backend, overlays and
cluster logic are untouched.

The local pins move to `ags-platform` `v0.9.0` / `contracts` `v0.7.0`; gates
run with the local overrides
`AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
`CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.

## Acceptance

- [ ] `app.tsx` imports `createAppearance`, declares one module-level
      `createAppearance({ configDir: "ags-capture" })`, and calls
      `appearance.apply()` in `main()`; no `theme`/`skin` import or apply call
      survives.
- [ ] The palette-refresh wiring is
      `createAppearanceRefreshHandler(appearance, work)`, where `work` only runs
      `refreshAppAppearance()`. The capture request surface and its commands are
      unchanged and there is still exactly one request handler.
- [ ] The panel width comes from
      `appearance.value("layout.ags-capture.panel-width", 560)` rather than a
      hard panel constant.
- [ ] `style.css` remains present with the bundled glass fallback, including
      `--rec-accent`; selectors, geometry, class vocabulary, gestures and
      behavior are unchanged.
- [ ] The local Makefile, CI workflow and pin test name `ags-platform` `v0.9.0`
      / `contracts` `v0.7.0`.
- [ ] A source-level validation test asserts the appearance apply/configDir
      wiring, the appearance-refresh handler, the layout token and the absence
      of theme/skin calls, plus the retained `style.css` fallback.
- [ ] `make gates` passes on the branch with the local overrides.
- [ ] The branch merges fast-forward to `main`, the next minor tag is created,
      and the tag + gate evidence are recorded in this ticket.

## Implementation Plan

- `app.tsx`: replace the Theme/Skin imports and startup pair with one
  module-level `createAppearance({ configDir: "ags-capture" })` and
  `appearance.apply()` in the existing try/catch.
- `app.tsx`: wire the palette-refresh path through
  `createAppearanceRefreshHandler(appearance, () => refreshAppAppearance())`;
  keep `createCaptureRequestHandler(paletteRefresh, cluster)` and every existing
  command.
- `app.tsx` / `ui/classic/ClassicWindow.tsx` / `ui/classic/SettingsPage.tsx`:
  read `layout.ags-capture.panel-width` (fallback `560`) and apply it to the
  settings panel with `peek()`, replacing the TSX-side hard width while
  `style.css` keeps the glass fallback.
- `lib/palette-refresh.ts` and the app-local hash helper are retired; the
  platform `createAppearanceRefreshHandler` owns the protocol and idempotence.
- `tests/validation/appearance-migration.test.mjs` replaces
  `skin-consumption.test.mjs`; `tests/app-contract.test.mjs`,
  `tests/ts/platform-consumption.test.ts`, `tests/unit.test.mjs` and
  `tests/ts/state-preservation.test.ts` follow the new wiring.
- `Makefile`, `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`,
  `CHANGELOG.md`: pin/describe the `ags-platform` v0.9.0 / `contracts` v0.7.0
  tuple and the Appearance plane.
