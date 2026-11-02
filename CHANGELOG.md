# Changelog

## Unreleased

- Migrate `style.css` from legacy `@color_*` carriers to the semantic
  `palette.v1` roles projected by `ags-platform` v0.4.0 (`@on_surface`,
  `@surface`, `@primary`/`@on_primary`, `@outline_variant`, `@error`). The
  mapping is by intent per site; geometry, alpha values, selectors and the
  palette-refresh path are unchanged.
- Pin `ags-platform` v0.4.0 while `contracts` stays v0.3.0, and add a
  validation gate that fails on any returning `@color_*` carrier.

## v0.1.0 — 2026-10-27

- Extract `capture-tool` from `ags-apps` v0.5.0 into the standalone
  `ags-capture-tool` repo (repo root is the app package).
- Identity: app/instance `capture`, config dir `ags-capture`, window
  `capture-window`, launcher `capture-ui`, keybind description “Open capture
  UI”, mode `live`, `holdsUnsavedState: false`.
- Replace the Theme-only v0.5.0 handler with a real `palette-refresh`: re-apply
  the Theme pointer, clear the built icon images, reload the generated capture
  icons in every live per-monitor window, re-measure the surface, and preserve
  the active view, settings/path editor and the one shared `UiState`.
- Add handler, conformance and state-preservation tests, including the
  in-flight `busy` path and monitor-unregister behaviour.
- Preserve `bin/capture-tool` and the Python backend pytest suites.
- Add the standalone dev flow (`AGENTS.md`, tickets, worktree guard, Makefile,
  CI, tests, frozen `templates/ags-app/`) and pin the local-only v0.3.0
  `ags-platform`/`contracts` tuple via `.dev/`.
