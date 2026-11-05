---
id: OPS-009
title: "Evidence and status reconciliation after EPIC-002"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/OPS-009/
branch: ticket/OPS-009-evidence-reconciliation
---

# Evidence and status reconciliation after EPIC-002

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Close the documentation and evidence gaps left after the EPIC-002 release:

- `tickets/EPIC-002-monitor-catalog-dropdowns/design.md` still carried the
  planning-time header `Status: planning complete; implementation not started.`
  Update it to the released state (runtime `v0.6.0`, capture `v0.4.0`, epic
  closed 2026-11-04).
- The epic ticket pointed only at the transient `/tmp/opencode/capture-dropdowns/`
  evidence. Point it at the durable copy
  `~/.opencode/evidence/capture-dropdowns/` while keeping the original paths as
  provenance.
- Record the mockup identity so a reader cannot pick the stale staging snapshot:
  the released mockup is `mockups/capture-tool-dropdowns.html`
  (`sha256 820b59cc…f5d3f0`, equal to the evidence bundle's
  `final-ticket-mockup.html`); the evidence bundle's
  `mockup/capture-tool-dropdowns.html` (`sha256 a3f8cb48…`) is the pre-`REQ-014`
  staged proposal and is historical.
- Fill the missing `palette-open.png` state from the design §4.4 matrix.

## Done-when

The EPIC-002 design and epic ticket describe the shipped release; the durable
evidence location and the released mockup hash are recorded; the palette-refresh
screenshot exists in the durable bundle.

## Evidence

- `tickets/EPIC-002-monitor-catalog-dropdowns/design.md` header now reads
  “implemented and released”.
- `tickets/EPIC-002-monitor-catalog-dropdowns/ticket.md` points at
  `~/.opencode/evidence/capture-dropdowns/` and records released mockup
  `sha256 820b59cc…f5d3f0` vs historical staging `a3f8cb48…`.
- `~/.opencode/evidence/capture-dropdowns/REQ-009/palette-open.png` — installed
  v0.4.0 app, Target popover open, `ags request palette-refresh
  ops009-palette-open -i capture` returned `{"ok":true}`; popover still open in
  the screenshot.
- `~/.opencode/evidence/capture-dropdowns/README.md` — durable mockup mapping,
  re-validation date, palette evidence command, installed-host state.

