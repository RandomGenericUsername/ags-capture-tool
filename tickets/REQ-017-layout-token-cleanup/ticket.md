---
id: REQ-017
title: "Remove the unused capture panel-width layout token"
kind: requirement
status: done
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

- [x] `app.tsx` no longer calls
      `appearance.value("layout.ags-capture.panel-width", 560)` and passes no
      panel width to `ClassicWindow`.
- [x] `ClassicWindow` and `SettingsPage` carry no `panelWidth` prop, and
      `.settings-page` has no explicit `widthRequest`.
- [x] `style.css` still owns `min-width: 560px` for `.settings-page` and
      `.capture-panel`; no CSS bytes change.
- [x] The app-scoped `createAppearance({ configDir: "ags-capture" })`, the
      single `appearance.apply()` in `main()` and the
      `createAppearanceRefreshHandler(appearance, work)` wiring are unchanged.
- [x] `tests/validation/appearance-migration.test.mjs` asserts no capture
      layout-token plumbing and still pins the CSS width fallbacks.
- [x] `make gates` passes on the branch with the local overrides
      `AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform` and
      `CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts`.
- [x] The branch fast-forwards to `main`, the next patch tag `v0.6.1` is
      created, and `main` plus the tag are pushed to `origin`.

## Implementation

- `app.tsx:46` still declares the one app-scoped
  `createAppearance({ configDir: "ags-capture" })`; `app.tsx:114` still calls
  `appearance.apply()` once in `main()`; `app.tsx:63` still wires
  `createAppearanceRefreshHandler(appearance, …)`. The removed
  `panelWidth` accessor is gone and `app.tsx:184` constructs
  `ClassicWindow(monitor, ports, state, selection)` with no width argument.
- `ui/classic/ClassicWindow.tsx` no longer imports `ReadAccessor` or accepts a
  `panelWidth` parameter; its `<SettingsPage …>` call drops the prop.
- `ui/classic/SettingsPage.tsx:329` restores the pre-v2 one-line
  `<box class="settings-page" orientation={Gtk.Orientation.VERTICAL}
  spacing={12}>`; there is no `widthRequest` and no `panelWidth` prop/import.
- `style.css:793` (`.capture-panel`) and `style.css:997` (`.settings-page`)
  keep `min-width: 560px`. `style.css` is byte-unchanged on this branch.
- `README.md` now states the panel width is CSS-owned and the app reads no
  capture layout token.
- `tests/validation/appearance-migration.test.mjs:199-224` replaces the token
  assertions with negative assertions: no `layout.ags-capture.panel-width`, no
  `appearance.value(`, no `panelWidth` plumbing and no `widthRequest`, while
  keeping the CSS `min-width: 560px` assertions.

## Evidence

### Source checks

- `rg -n "layout\.ags-capture|panelWidth|widthRequest" app.tsx
  ui/classic/ClassicWindow.tsx ui/classic/SettingsPage.tsx README.md` returns
  no matches on this branch.
- `git diff 374981f..16fd10e -- app.tsx ui/classic/ClassicWindow.tsx
  ui/classic/SettingsPage.tsx` removes only the accessor, the two prop hops and
  the explicit `widthRequest`; no other layout/behavior line changes.
- `git diff 374981f..HEAD -- style.css` is empty: both `min-width: 560px`
  rules and all other CSS bytes survive.
- `app.tsx` still contains exactly one `createAppearance(` call, one
  `appearance.apply()` in `main()`, and the
  `createAppearanceRefreshHandler(appearance, …)` wiring; the validation test
  sections 1–4 and 6 still pass.
- `node tests/validation/appearance-migration.test.mjs` exits 0.

### Gates

Command (worktree `.worktrees/REQ-017/`, branch
`ticket/REQ-017-layout-token-cleanup`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: exit 0. Full log:
`/tmp/opencode/ags-capture-req017-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/unit.test.mjs` | 8/8 pass |
| `make test` — `tests/validation` | 2/2 pass (includes `appearance-migration.test.mjs`) |
| `make test` — `tests/ts` | 403/403 pass |
| `make test` — test-program `tsc` | 0 errors |
| `make conformance` | 17/17 pass, including the platform template gate and the v0.9.0 / v0.7.0 pin assertion |
| `make backend` | 114/114 pass |
| `make bundle` | `build/capture.js`, 2,064,516 bytes |
| `make typecheck` | 0 errors in the ags-capture-tool tree; 28 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

Local platform checkout: `/home/inumaki/Development/dotfiles/ags-platform`
(`v0.9.0`); contracts `/home/inumaki/Development/dotfiles/contracts`
(`v0.7.0`).

## Release and merge

- Planning commit: `879c3f7` — `tickets: file REQ-017 layout token cleanup`.
- Implementation commit: `16fd10e` —
  `fix(REQ-017): restore CSS-owned settings panel width`.
- Test commit: `494e5d5` —
  `test(REQ-017): reject capture layout token plumbing`.
- Release-note commit: `5f6c766` —
  `chore(release): ags-capture-tool v0.6.1`.
- This closeout commit records the evidence and is fast-forwarded into `main`
  (no merge commit), then annotated as `v0.6.1`, the next patch after `v0.6.0`.
- `main` and the `v0.6.1` tag are pushed to `origin`; no existing tag is moved.

## Deviations

- None. The change restores the exact pre-v2 TSX construction while the v2
  appearance apply/configDir/refresh wiring stays intact.

## Follow-ups (not this ticket)

- The assets repo removes `[groups.layout.ags-capture]` in parallel; this app
  no longer reads it.
