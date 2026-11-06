---
id: REQ-017
title: "Remove the unused capture panel-width layout token"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-017/
branch: ticket/REQ-017-layout-token-cleanup
---

# Remove the unused capture panel-width layout token

## Requirement

The v2 appearance migration added
`appearance.value("layout.ags-capture.panel-width", 560)` plus
`widthRequest={panelWidth.peek()}` to the settings panel. Pre-v2 the `560` width
existed only as the `style.css` `min-width`, not as a TSX request. The assets
repo is removing the now-unused `[groups.layout.ags-capture]` token in parallel,
so the app must stop reading it.

Remove the accessor/prop plumbing from `app.tsx`, `ui/classic/ClassicWindow.tsx`
and `ui/classic/SettingsPage.tsx`, and restore the pre-v2 construction with no
explicit `widthRequest`; the CSS `min-width: 560px` governs again. The appearance
factory/apply, `configDir` and `palette-refresh` wiring are unchanged. Update the
source validation test so it rejects capture layout-token usage. No other
layout or behavior change.

## Acceptance

- [ ] `app.tsx` no longer calls
      `appearance.value("layout.ags-capture.panel-width", 560)` and passes no
      panel width to `ClassicWindow`.
- [ ] `ClassicWindow` and `SettingsPage` carry no `panelWidth` prop, and
      `.settings-page` has no explicit `widthRequest`.
- [ ] `style.css` still owns `min-width: 560px` for `.settings-page` and
      `.capture-panel`; no CSS bytes change.
- [ ] The app-scoped `createAppearance({ configDir: "ags-capture" })`, the
      single `appearance.apply()` in `main()` and the
      `createAppearanceRefreshHandler(appearance, work)` wiring are unchanged.
- [ ] `tests/validation/appearance-migration.test.mjs` asserts no capture
      layout-token plumbing and still pins the CSS width fallbacks.
- [ ] `make gates` passes on the branch with the local overrides
      `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
      `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.
- [ ] The branch fast-forwards to `main`, the next patch tag `v0.6.1` is
      created, and `main` plus the tag are pushed to `origin`.
