# ags-capture-tool

Standalone AGS screenshot/recording app: an AGS/GTK4 GUI over the preserved
Python backend CLI (`bin/capture-tool`). The repo root **is** the app package.
A recorder backend is selected behind an abstraction, so `gpu-screen-recorder`
and `wf-recorder` are swappable without redesigning the UI.

| Field | Value |
| --- | --- |
| Repo | `ags-capture-tool` |
| App id | `capture` |
| AGS instance | `capture` |
| Config dir | `ags-capture` |
| Window | `capture-window` |
| Launcher | `capture-ui` |
| Keybind description | Open capture UI |
| Manifest mode | `live` (`holdsUnsavedState: false`) |

`app.manifest.json` is the single identity source. The runtime discovers the
deployed config link, requires `manifest.instance == app.tsx instanceName ==
ags list`, and requires `manifest.configDir == the deployed link basename`
(`~/.config/ags-capture`).

The backend keeps its own deployed binary link name `capture-tool` and its
backend-owned config under `$XDG_CONFIG_HOME/capture-tool/config.json`; those
are backend contracts, not the AGS app identity.

## Repo layout

```text
app.tsx                  AGS entry point (instance capture)
app.manifest.json        identity tuple
lib/                     pure appearance/refresh core + handler wiring
ui/appearance.ts         the process-wide per-window appearance registry
ui/classic/              ClassicWindow + screenshot/recording/settings pages
ui/shared/               row/group/icon builders (icon slots are refreshable)
domain/                  PURE: settings, UI state, monitor planning, argv
ports/                   interfaces only: no implementation, no I/O
adapters/                all GTK/GLib/process I/O (stores, launcher, monitors)
bin/capture-tool         preserved Python backend CLI (stdlib only)
tests/                   Node unit + copied app tests + Python backend pytest
templates/ags-app/       frozen copyable template for the next app repo
```

`domain/` and `ports/` remain pure by rule: no `ags/*` or `gi://*` imports.
`lib/` is also desktop-free, which is why the refresh core executes under plain
Node in the stock-runner gates.

## Runtime contract: `palette-refresh`

The runtime invokes `ags request palette-refresh <appearance-hash> -i capture`
after an appearance change. The app:

1. re-applies the stable Theme pointer (`$XDG_CONFIG_HOME/ags/colors.css`);
2. fans out to **every live per-monitor window** and, in order:
   - clears the built icon images (the app's only palette-dependent cache),
   - reloads the generated capture icons from
     `$XDG_STATE_HOME/dotfiles/current/icons` and rebuilds each `Gtk.Image`,
   - re-measures/re-asserts the layer-surface size;
3. answers through `createPaletteRefreshHandler` with exactly one JSON string
   (`{"ok":true}` or a protocol failure).

The per-monitor windows are **updated in place, never destroyed or recreated**.
The active screenshot/recording/settings surface, the mode switch, the open
inline path editor, the selected option groups and the one shared
`createUiState()` object all survive. Overlapping requests answer
`{"ok":false,"error":"busy","retryable":true}` rather than queueing.

The refresh is idempotent by appearance hash. A throw is not recorded as
applied, so the runtime retries the same hash on its next trigger.

### Residual (explicit)

A full window teardown/rebuild is deliberately not used: it cannot preserve the
active view/focus, the open inline path editor and the pages' captured group
lists safely. The safe refresh therefore rebuilds **icon widgets and CSS** in
place. The structural widget tree is not recreated; a future palette-dependent
non-icon widget must add its own step to `AppearanceSurface`. Capture has no
such widget today — palette colour lives in `style.css`, which the Theme pointer
reloads.

## Local development

The program tuple is `ags-platform` / `contracts` `v0.3.0`, local-only in this
run. The local gates symlink both under `.dev/` (gitignored): the platform from
`../ags-platform`, and contracts from `../contracts` via `make conformance`.

```sh
ln -s ../../../ags-platform .dev/ags-platform/v0.3.0   # or use AGS_PLATFORM_DEV
make test          # pure unit + copied app tests (Node only)
make conformance   # manifest + handler + template gate
make backend       # Python backend pytest suite (uv)
make typecheck     # LOCAL desktop stack: ags + GIR declarations
make bundle        # LOCAL: ags bundle app.tsx build/capture.js
make gates         # all of the above
```

`make test`, `make conformance` and `make backend` are the stock-runner gates.
Typecheck is local and authoritative; CI deliberately has no self-hosted job.

Run the app:

```sh
ags run -d .
ags request toggle -i capture   # or the provisioned capture-ui launcher
```

## Creating the next app repo

Copy `templates/ags-app/` to the new repo root, fill the placeholders declared
in `templates/ags-app/template.json`, then run `make test` and `make
conformance`. No generator is required. Keep the template frozen per release
(AD-33).

## Consumer surfaces

`dotfiles-v3`/`dotfiles-provision` own the app list, install tag, config link
and launcher; `dotfiles-assets` owns the keybind described as **Open capture
UI**. This repo does not provision or edit those repos; it proves only the
app-side contract.
