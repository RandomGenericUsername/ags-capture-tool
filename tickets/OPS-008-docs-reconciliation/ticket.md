---
id: OPS-008
title: "Documentation reconciliation: historical mockup/design + stale comments"
kind: ops-task
status: done
lane: 1 — XS direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-012]
blocks: [OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
---

# Documentation reconciliation

## Done-when

The historical EPIC-001 mockup/design cannot be mistaken for the current
reference, and current code comments no longer say `bar.recording_hud`.

## Report

User reported still seeing old vocabulary in “the mockup”. The attached image
was the btop theme studio preview (`GPU0`/`GPU1`), not this repo. The actual
stale capture references were the EPIC-001 mockup/design and the
`ClassicWindow`/`recording-hud` comments. This ticket labels or fixes them and
records the exact paths.

## Tasks

- [x] Add a top-of-file historical banner to
  `tickets/EPIC-001-capture-bar-redesign/mockups/capture-bar-mockups.html`.
- [x] Add a top-of-file historical note to
  `tickets/EPIC-001-capture-bar-redesign/design.md`.
- [x] Update stale `bar.recording_hud` comments in
  `ui/classic/ClassicWindow.tsx` (the `applyHudVisibility`, `enterLiveHud`,
  `commitCurrentMode`, `settingsChanged` blocks) and
  `domain/recording-hud.ts`.
- [x] Add a “current references” block to the EPIC-002 ticket and `INDEX.md`.
- [x] Do not rewrite historical ticket evidence or release handoffs.
- [x] Record the exact file path the user reported and whether it was fixed or
  labeled historical.

## Evidence

- `make test` → 360 pass, 0 fail; `make conformance` → 17 pass;
  `make backend` → 114 passed.
- `rg -n "bar\.recording_hud" ui domain style.css` → only the intentional
  legacy-migration references in `domain/settings.ts` and
  `domain/recording-presentation.ts`.
- Historical banners:
  `tickets/EPIC-001-capture-bar-redesign/mockups/capture-bar-mockups.html:123`
  and `tickets/EPIC-001-capture-bar-redesign/design.md:3`.
- Current reference pointer: `tickets/EPIC-002-monitor-catalog-dropdowns/ticket.md`
  and `tickets/INDEX.md`.
- Reported image: btop theme studio preview (`GPU0`/`GPU1`), not this repo;
  the actual stale capture files were the EPIC-001 records and the two comment
  blocks, now fixed/labeled.
