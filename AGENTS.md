# AGENTS.md — ags-capture-tool operating contract

Canonical agent instructions for this repo. Claude (`CLAUDE.md` symlinks here),
OpenCode and every BMAD/OpenSpec skill must follow this.

## 1. Evidence rule

Every technical claim carries testable evidence: a file path + line range, a
commit SHA, a URL + quoted section, or an executed command with its result.
Non-trivial claims get `Evidence:` and `Verify:` lines. If evidence does not
exist, write `Evidence: MISSING — run <X>`; never present the claim as fact.

## 2. Identity and layout

The repo root IS the app package (`app.tsx` at the root). Identity is
single-valued in `app.manifest.json`:

```text
app=capture  instance=capture  configDir=ags-capture  mode=live
```

- Window: `capture-window`; launcher: `capture-ui`; keybind description:
  “Open capture UI”.
- No app imports another app. `ags-platform` is the runtime dependency;
  `contracts` is a test-time schema dependency.
- The runtime is the only palette-refresh trigger. Do not subscribe to
  `wallpaper.state` for palette application.
- `bin/capture-tool` is the preserved Python backend. Its deployed binary name
  and its `$XDG_CONFIG_HOME/capture-tool/config.json` are backend contracts;
  they are not the AGS app identity.
- `capture-window` is shared by every monitor's window. `style.css` selects it
  with `window#capture-window`, and the provisioned `capture-ui` launcher
  toggles it by that name. A rename needs both consumers, not just this repo.

## 3. Ticket flow

All work starts in `tickets/` (`_template/`, `INDEX.md`, `LIFECYCLE.md`).
Never work on main: `scripts/worktree-guard.sh check-clean` then
`scripts/worktree-guard.sh create <id> <slug>`. Record `worktree=` and
`branch=` in the ticket.

## 4. Gates

- `make test`, `make conformance` and `make backend` are the stock-runner CI
  gates.
- `make typecheck` and `make bundle` are LOCAL: they need `ags` and GIR.
- CI has no self-hosted runner and no secrets.
- `.dev/`, `node_modules/`, `@girs/`, generated `tsconfig.json`, Python caches
  and bundle output are never committed.

## 5. Live refresh invariants

- Exactly one JSON-string response, through `createPaletteRefreshHandler`.
- Idempotent by appearance hash; a throw is retryable and not recorded applied.
- Clear the built icon images before rebuilding them; re-measure the surface
  after the icon pass.
- Refresh every live per-monitor window through `ui/appearance.ts`; unregister
  a window on `destroy` so a removed monitor cannot be touched.
- Preserve the visible/active surface, the open settings/path editor, the
  selected groups and the shared `UiState` object. Never hide, destroy or
  recreate the windows just to apply a palette.
- An overlapping request answers `busy`; never queue it and never restart the
  process.
- The residual is deliberate: this refresh rebuilds icons/CSS, not the
  structural widget tree. A future palette-dependent non-icon widget must add
  an `AppearanceSurface` step.

## 6. Releases

Immutable annotated tags; a published tag is never moved. Installed tags are
read-only and writable state lives under XDG paths (AD-37). Tag only after
`make gates` passes.
