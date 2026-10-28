---
id: REQ-001
title: "Migrate capture-tool to standalone ags-capture-tool with live refresh"
kind: requirement
status: done
lane: 3
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Migrate capture-tool to standalone ags-capture-tool with live refresh

## Requirement

Create the standalone `ags-capture-tool` repo from `ags-apps` v0.5.0
`capture-tool/` and the frozen `ags-clipboard/templates/ags-app/` template,
with the repo root as the app package. Deliver the real live `palette-refresh`,
the preserved Python backend/bin, the copied app tests and the standalone dev
flow. This ticket does not provision, cut over, push or change a GUI/host.

## Acceptance

- [x] `app.tsx` is at the repo root; there is no app subdirectory.
- [x] Identity is `app/instance=capture`, `configDir=ags-capture`, window
      `capture-window`, launcher `capture-ui`, keybind description “Open capture
      UI”, `mode: live`, `holdsUnsavedState: false`.
- [x] `palette-refresh` re-applies the Theme pointer and reloads the generated
      icons in every live per-monitor window, without closing the active
      surface or resetting shared UI state; one JSON-string response;
      idempotent by appearance hash; an in-flight request answers busy.
- [x] `AGENTS.md`, `tickets/LIFECYCLE|INDEX|_template`, worktree guard,
      Makefile, CI, README, tests and `templates/ags-app/` are present and the
      platform template-conformance gate passes.
- [x] `bin/capture-tool` and `tests/python/` are preserved.
- [x] Local gates pass: `make test`, `make conformance`, `make backend`,
      `make typecheck`, `make bundle`.
- [x] Annotated tag `v0.1.0` is created after the gates pass; nothing is pushed.

## Evidence

- `make gates` → exit 0 (test + conformance + backend + bundle + typecheck):
  - `make test` → 10/10 handler/appearance tests (`tests/unit.test.mjs`),
    154/154 copied + new TS tests (`tests/ts/`), and the tests project
    typechecks cleanly (`tsconfig.tests.json`, 0 errors).
  - `make conformance` → 16/16 pass (`tests/app-contract.test.mjs`), including
    the platform `checkAppRepo` template gate and the manifest identity.
  - `make backend` → 97 passed (`bin/capture-tool`, preserved).
  - `make bundle` → `build/capture.js`, 1,078,584 bytes.
  - `make typecheck` → 0 errors in the ags-capture-tool tree (28 tolerated
    `/usr/share/ags/js` errors, 0 platform errors).
- Refresh evidence: `lib/appearance.ts` orders clear → rebuild icons →
  re-measure. `ui/classic/ClassicWindow.tsx` registers one surface per live
  window (`clearCaches=iconSlots.clear`, `rebuildIcons=iconSlots.refresh`,
  `refreshWindow=syncWindowSize`) and unregisters on `destroy`.
  `ui/appearance.ts` fans out to every window without hide/destroy/recreate.
  `tests/unit.test.mjs` proves one JSON-string response, same-hash no-op,
  retryable failure, and the in-flight busy response. `tests/ts/state-preservation.test.ts`
  proves both monitor windows reload icons, the shared `UiState` and active
  view/draft survive, hidden windows stay hidden and removed monitors stop
  refreshing.
- Residual: this is an in-place icon/CSS refresh, not a structural widget-tree
  rebuild. A full teardown was rejected because it cannot preserve the active
  view/focus or the open inline path editor; a future palette-dependent
  non-icon widget must add an `AppearanceSurface` step.
- Tag: `v0.1.0` annotated, local-only (not pushed).
