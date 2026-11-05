---
id: REQ-014
title: "Compact/detailed bar field presentation setting"
kind: requirement
status: done
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

- [x] `CaptureSettings.bar_fields` is `"compact" | "detailed"`, default
  `compact`; missing/corrupt values degrade to `compact`.
- [x] Settings → Behaviour shows `Bar fields: Compact | Detailed`; edits persist
  immediately.
- [x] Compact is the dropdown bar; Detailed is the inline option-group bar;
  both cover every existing option in both lanes.
- [x] Switching preserves the current `UiState`, closes any open popover, and
  calls `syncWindowSize()` once.
- [x] Both presentations consume `field-defs.ts`; no duplicate option table.
- [x] The detailed row keeps the mode tabs, dividers, CTA and recording
  structural red; it does not use popovers.
- [x] Detailed duration `Custom` reveals the inline seconds editor (the old
  behavior); compact keeps the editor inside the popover. The bar may grow in
  detailed mode only.
- [x] Tests: default compact; corrupt -> compact; detailed renders every option;
  switching preserves state; one resize per switch; parity covers both.
- [x] Gates pass; live evidence `detailed-shot.png`, `detailed-rec.png`,
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

### Gates (run from `.worktrees/EPIC-002`)

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# 392 tests pass, 0 fail; tests/ts tsc clean

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make conformance
# 17 tests pass, 0 fail

make backend
# 114 passed

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make typecheck
# OK: 0 errors in the ags-capture-tool tree

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make bundle
# OK: build/capture.js (1960884 bytes)
```

### Measured layer widths

`hyprctl layers -j` after `syncWindowSize()`, same 1920×1080 host:

| Presentation | Screenshot | Recording |
|---|---|---|
| Compact | 631 px | 745 px |
| Detailed | 1172 px | 1733 px |

Compact stays within the 700/900 px budgets; Detailed is wider by design and
was not shrunk.

### Live evidence

- `/tmp/opencode/capture-dropdowns/REQ-014/detailed-shot.png` (full screen)
- `/tmp/opencode/capture-dropdowns/REQ-014/detailed-shot-bar.png` (bar crop, 1172 px)
- `/tmp/opencode/capture-dropdowns/REQ-014/detailed-rec.png` (full screen)
- `/tmp/opencode/capture-dropdowns/REQ-014/detailed-rec-bar.png` (bar crop, 1733 px)
- `/tmp/opencode/capture-dropdowns/REQ-014/settings-bar-fields.png` (Settings → Behaviour)
- `/tmp/opencode/capture-dropdowns/REQ-014/settings-bar-fields-panel.png` (panel crop)
- `/tmp/opencode/capture-dropdowns/REQ-014/compact-shot-bar.png` (compact screenshot lane, 631 px)

### Tests

`tests/ts/bar-field-presentation.test.ts` covers default/corrupt merge, the
mockup `settings.barFields` contract, the Behaviour row, both presentations
sharing `currentOptions`, the in-place switch preserving `UiState` and closing
popovers, exactly one `syncWindowSize()` per switch, and the compact/detailed
duration editors. `tests/ts/domain-settings.test.ts`, `bar-shell.test.ts` and
`custom-duration-spin.test.ts` were updated for the new row/key.
