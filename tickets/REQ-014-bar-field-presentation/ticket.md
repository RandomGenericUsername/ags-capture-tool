---
id: REQ-014
title: "Compact/detailed bar field presentation setting"
kind: requirement
status: proposed
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-010, REQ-011, REQ-012]
blocks: [REQ-013, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Compact/detailed bar field presentation setting

## Requirement

Let the user choose the new compact dropdown bar or the old detailed inline
option bar. Both presentations read the same `field-defs` vocabulary.

## Acceptance

- [ ] `CaptureSettings.bar_fields` is `"compact" | "detailed"`, default
  `compact`; missing/corrupt values degrade to `compact`.
- [ ] Settings → Behaviour shows `Bar fields: Compact | Detailed`; edits persist
  immediately.
- [ ] Compact is the dropdown bar; Detailed is the inline option-group bar;
  both cover every existing option in both lanes.
- [ ] Switching preserves the current `UiState`, closes any open popover, and
  calls `syncWindowSize()` once.
- [ ] Both presentations consume `field-defs.ts`; no duplicate option table.
- [ ] The detailed row keeps the mode tabs, dividers, CTA and recording
  structural red; it does not use popovers.
- [ ] Detailed duration `Custom` reveals the inline seconds editor (the old
  behavior); compact keeps the editor inside the popover. The bar may grow in
  detailed mode only.
- [ ] Tests: default compact; corrupt -> compact; detailed renders every option;
  switching preserves state; one resize per switch; parity covers both.
- [ ] Gates pass; live evidence `detailed-shot.png`, `detailed-rec.png`,
  `settings-bar-fields.png`.

## Implementation map

- `domain/settings.ts` — `bar_fields`, `CONFIG_BAR_FIELDS`, default, merge.
- `ui/shared/field-defs.ts` — `BAR_FIELD_PRESENTATIONS`, `DEFAULT_BAR_FIELDS`.
- `ui/shared/dropdown.ts` — inline renderer sharing `FieldOptionDef[]` and the
  same handle surface.
- `ui/classic/ScreenshotPage.tsx`, `RecordingPage.tsx` — choose renderer.
- `ui/classic/SettingsPage.tsx`, `ui/shared/settings-defs.ts` — Behaviour row.
- `ui/classic/ClassicWindow.tsx` — pass presentation; preserve state; resize.
- `tests/ts/*` — presentation/state/parity tests.

## Evidence

Gate output; measured widths for both presentations; live screenshots; parity
test output.
