---
id: OPS-007
title: "Release and pins"
kind: ops-task
status: proposed
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

- [ ] Runtime `make gates`; tag `v0.6.0`; release notes.
- [ ] Capture `make gates`; tag `v0.4.0`; release notes.
- [ ] `dotfiles-v3`: runtime `v0.6.0` in `cli-tools.yaml`; capture `v0.4.0` in
  `apps.yaml`; program tuple unchanged.
- [ ] `make gates-ci`, `make deploy-coverage`; record output.
- [ ] Update INDEX/CHANGELOG/release record.
- [ ] Do not move published tags.

## Evidence

Tag SHAs; gate output; deploy-coverage output; installed CLI/app check.
