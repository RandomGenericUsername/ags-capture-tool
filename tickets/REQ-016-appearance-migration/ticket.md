---
id: REQ-016
title: "Migrate the capture tool to the v2 Appearance plane"
kind: requirement
status: done
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

- [x] `app.tsx` imports `createAppearance`, declares one module-level
      `createAppearance({ configDir: "ags-capture" })`, and calls
      `appearance.apply()` in `main()`; no `theme`/`skin` import or apply call
      survives.
- [x] The palette-refresh wiring is
      `createAppearanceRefreshHandler(appearance, work)`, where `work` only runs
      `refreshAppAppearance()`. The capture request surface and its commands are
      unchanged and there is still exactly one request handler.
- [x] The panel width comes from
      `appearance.value("layout.ags-capture.panel-width", 560)` rather than a
      hard panel constant.
- [x] `style.css` remains present with the bundled glass fallback, including
      `--rec-accent`; selectors, geometry, class vocabulary, gestures and
      behavior are unchanged.
- [x] The local Makefile, CI workflow and pin test name `ags-platform` `v0.9.0`
      / `contracts` `v0.7.0`.
- [x] A source-level validation test asserts the appearance apply/configDir
      wiring, the appearance-refresh handler, the layout token and the absence
      of theme/skin calls, plus the retained `style.css` fallback.
- [x] `make gates` passes on the branch with the local overrides.
- [x] The branch merges fast-forward to `main`, the next minor tag is created,
      and the tag + gate evidence are recorded in this ticket.

## Implementation

- `app.tsx:9-10` imports `createAppearance` and
  `createAppearanceRefreshHandler`; `app.tsx:46` declares the one
  `createAppearance({ configDir: "ags-capture" })`;
  `app.tsx:67-69` wires the platform helper with the existing
  `refreshAppAppearance()` fan-out; `app.tsx:118` calls `appearance.apply()`
  once in `main()` inside the existing try/catch. The Theme/Skin imports and
  both apply calls are gone.
- The single request surface is unchanged: `app.tsx:77` keeps
  `createCaptureRequestHandler(paletteRefresh, …)` and the cluster indirection;
  `lib/request-dispatch.ts` still dispatches `palette-refresh` and
  `capture-cluster`, and no new command is added.
- `app.tsx:50` reads `appearance.value("layout.ags-capture.panel-width", 560)`;
  `app.tsx:189` passes the accessor to `ClassicWindow`;
  `ui/classic/ClassicWindow.tsx:1736` passes it to `SettingsPage`; and
  `ui/classic/SettingsPage.tsx:344` applies it with
  `widthRequest={panelWidth.peek()}`. `style.css` is byte-unchanged and keeps
  both `min-width: 560px` fallbacks plus `--rec-accent`.
- `lib/palette-refresh.ts` and the local `createAppearanceRefresh` hash helper
  are removed; the platform helper owns the protocol, hash idempotence and
  retry semantics.
- `tests/validation/appearance-migration.test.mjs` replaces
  `skin-consumption.test.mjs`. It asserts one app-scoped appearance, one apply
  in `main()`, `createAppearanceRefreshHandler(appearance, work)`, the unchanged
  request/cluster surface, no theme/skin call, the layout token, and the
  retained `style.css` fallback. `tests/app-contract.test.mjs`,
  `tests/ts/platform-consumption.test.ts`, `tests/unit.test.mjs` and
  `tests/ts/state-preservation.test.ts` follow the same wiring and run through
  the platform handler.
- `Makefile:8-9` pins `AGS_PLATFORM_VERSION := v0.9.0` and
  `CONTRACTS_VERSION := v0.7.0`; `.github/workflows/ci.yml` checks out the same
  tags; `tests/app-contract.test.mjs:272-275` asserts the tuple.

## Evidence

### Source checks

- `app.tsx:46` is the only `createAppearance(` call; `app.tsx:118` is the only
  `appearance.apply()` call in `main()`.
- `app.tsx` contains no `ags-platform/adapters/theme`,
  `ags-platform/adapters/skin`, `createAppSkin`, `theme.apply()` or
  `skin.apply()` after comments are stripped.
- `app.tsx:67` is
  `const paletteRefresh = createAppearanceRefreshHandler(appearance, () => {`
  and `app.tsx:68` is `refreshAppAppearance()`. The work callback does not
  re-apply the appearance or the retired theme/skin.
- `app.tsx:50` matches
  `appearance.value("layout.ags-capture.panel-width", 560)` and
  `ui/classic/SettingsPage.tsx:344` reads it with `panelWidth.peek()`.
- `git diff --quiet 4b4620b HEAD -- style.css` exits 0: `style.css` is
  unchanged by this ticket, including `.capture-panel`,
  `.settings-page`, `--rec-accent` and `window#capture-window`.
- `tests/validation/appearance-migration.test.mjs` passes in `make test`; its
  forbidden list rejects the retired Theme/Skin imports and apply calls.

### Gates

Command (worktree `.worktrees/REQ-016/`, branch
`ticket/REQ-016-appearance-migration`):

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts \
make gates
```

Result: exit 0. Full log:
`/tmp/opencode/ags-capture-req016-gates.log`.

| Gate | Result |
| --- | --- |
| `make test` — `tests/unit.test.mjs` | 8/8 pass |
| `make test` — `tests/validation` | 2/2 pass (includes `appearance-migration.test.mjs`) |
| `make test` — `tests/ts` | 403/403 pass |
| `make test` — test-program `tsc` | 0 errors |
| `make conformance` | 17/17 pass, including the platform template gate and the v0.9.0 / v0.7.0 pin assertion |
| `make backend` | 114/114 pass |
| `make bundle` | `build/capture.js`, 2,066,952 bytes |
| `make typecheck` | 0 errors in the ags-capture-tool tree; 28 tolerated `/usr/share/ags/js` errors, 0 `ags-platform` errors |

Local platform checkout: `/home/inumaki/Development/dotfiles/ags-platform`
(`v0.9.0`); contracts `/home/inumaki/Development/dotfiles/contracts`
(`v0.7.0`); runtime `v0.9.1`; assets `v0.12.1`.

## Release and merge

- Planning commit: `e2c322f` — `tickets: file REQ-016 appearance migration`.
- Implementation commit: `bf1fd03` —
  `feat(REQ-016): consume the v2 appearance plane`.
- Pin commit: `767abbb` —
  `chore(REQ-016): pin platform v0.9.0 / contracts v0.7.0`.
- Test commit: `d9a4983` —
  `test(REQ-016): pin appearance consumption wiring`.
- Release-note commit: `e37c188` —
  `chore(release): ags-capture-tool v0.6.0`.
- This closeout commit records the evidence, is fast-forwarded into `main` (no
  merge commit), then annotated as `v0.6.0`, the next minor after `v0.5.0`.
- No existing tag is moved; nothing is pushed.

## Deviations

- The hard panel width existed only as `style.css` `min-width: 560px`; there was
  no TSX `560` constant. The token is therefore applied as the settings panel's
  `widthRequest` with the same `560` fallback, while `style.css` keeps the
  glass fallback as required. No visual change occurs at the default token
  value.
- `templates/ags-app/` keeps its frozen v1 Theme/skin template and pins, as
  prior app-local migrations did; this ticket scopes the migration to the app
  package.
- No runtime screenshot/e2e was captured. This ticket changes imports,
  startup/refresh wiring and the panel-width source only; the bundle gate proves
  the Appearance adapter resolves, typecheck proves the accessor types, and the
  source gate pins the wiring.

## Follow-ups (not this ticket)

- None.
