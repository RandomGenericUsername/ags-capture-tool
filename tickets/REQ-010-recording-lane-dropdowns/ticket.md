---
id: REQ-010
title: "Recording lane dropdowns + conditional states"
kind: requirement
status: proposed
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-009]
blocks: [REQ-012, REQ-013, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
---

# Recording lane dropdowns + conditional states

## Requirement

Convert the recording lane to the shared field primitive and preserve every
capability, including GIF reflow and custom duration.

## Acceptance

- [ ] Fields: Target, Monitor (conditional), FPS/GIF FPS, Format, Quality,
  Audio/Size, Duration, Cursor; no side-by-side option group remains.
- [ ] GIF switches FPS to 10/15/20/30 and Audio→Size in the same slot; the bar
  does not jump; switching back restores the stored values.
- [ ] Custom duration is an editor inside the duration popover; Enter sets,
  Esc restores; the bar does not grow.
- [ ] Recording red is structural (tab/CTA/tally/border/open ring); fields stay
  neutral.
- [ ] Recording lane width ≤ 900 px, measured and recorded.
- [ ] S4 HUD, `recording_controls` and `bar_compact_controls` are unchanged.
- [ ] Gates pass; live evidence: `rec-closed.png`, `rec-format-open.png`,
  `rec-gif.png`, `rec-custom.png`.

## Implementation map

- `ui/classic/RecordingPage.tsx`
- `ui/classic/ClassicWindow.tsx` — recording field handles and `applyStateToUi`.
- `style.css` — custom editor + recording structural red.
- Remove the old inline `.custom-duration` bar widget.

## Evidence

Gate output; measured width; live screenshots; GIF round-trip test.
