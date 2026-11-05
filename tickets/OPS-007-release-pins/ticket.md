---
id: OPS-007
title: "Release and pins"
kind: ops-task
status: done
lane: 1 — XS direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [dotfiles-runtime, ags-capture-tool, dotfiles-v3]
depends-on: [REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, OPS-008]
blocks: []
---

# Release and pins

## Done-when

Runtime `v0.6.0` and capture `v0.4.0` are tagged on green commits; the
composition pins match; `make gates-ci` and `make deploy-coverage` are green.

## Tasks

- [x] Runtime `make gates`; tag `v0.6.0`; release notes.
- [x] Capture `make gates`; tag `v0.4.0`; release notes.
- [x] `dotfiles-v3`: runtime `v0.6.0` in `cli-tools.yaml`; capture `v0.4.0` in
  `apps.yaml`; program tuple unchanged.
- [x] `make gates-ci`, `make deploy-coverage`; record output.
- [x] Update INDEX/CHANGELOG/release record.
- [x] Do not move published tags.

## Evidence

Tag SHAs; gate output; deploy-coverage output; installed CLI/app check.

## Evidence

- Runtime `v0.6.0` annotated tag on `6c4c727`; pushed to origin; `make gates` green after the tag (2208 passed, 2 skipped).
- Capture `v0.4.0` annotated tag on `3ff839b`; pushed to origin; final gates: 403 tests, conformance 17, backend 114, typecheck 0 errors, bundle 1,960,884 bytes.
- `dotfiles-v3` pin commit `08b36428` (runtime v0.6.0, capture v0.4.0, `FINAL_APP_RELEASES` capture v0.4.0); merged as `44170918` and pushed.
- `dotfiles-v3` `make gates-ci` and `make deploy-coverage` both PASS on the pin branch; deploy-coverage reports the pin set and the seven-app final topology.
- Installed host remains on the previous capture tag until the next provision/apply; the deployed pin is the v0.4.0 tag and the live UI evidence is under `/tmp/opencode/capture-dropdowns/`.
