---
id: REQ-004
title: "Recording lifecycle — red accent + live HUD (S4)"
kind: requirement
status: proposed
lane: 3
links:
  openspec: none
  bmad: none
worktree: none
branch: none
---

# Recording lifecycle: red accent + live HUD

## Requirement

Recording carries the red-accent convention (design.md D4/D7, FR-7) and ships
the S4 live-recording HUD state (FR-8) honoring the existing
`bar_compact_controls` setting, on top of the REQ-002 bar and REQ-003 pending
protocol.

## Acceptance

- [ ] Red accent applies in every recording state (S1/S3 pending, and lane
      chips): active mode chip, **selected** pills, CTA background, and CTA
      label flips `Capture → Record` (frames Sheet 1/3 recording states;
      `--rec-accent` ≈ the palette's red accent, wired through the palette
      refresh, not a hardcoded literal).
- [ ] S4 HUD while recording is live: pulsing red dot, elapsed `MM:SS` timer,
      Pause/Stop buttons; **no target/fps/quality/audio pills**, no `←`
      (INV-2 excludes S4; frame Sheet 3 `S4`).
- [ ] Options locked while live: changing target/format/etc. is impossible
      until `⏹ Stop` returns the bar to S0 (INV-5: S2/S3 overlay machinery is
      fully torn down once live).
- [ ] `bar_compact_controls` (domain/settings.ts L28–30) semantics are
      honored identically to today: `true` → dot+timer only in the bar and
      Pause/Stop carried by the popup; `false` → bar carries the buttons.
      Both modes covered by TS tests.
- [ ] Pause/resume keeps the timer continuous (elapsed time excludes paused
      spans, matching the backend timer semantics — verify against backend
      timekeeping before asserting; stop always terminates backend capture).
- [ ] Recording live state survives `palette-refresh` in place (INV-4): HUD
      widgets are refreshed, timer value and pause state preserved.
- [ ] Gates: `make test`, `make conformance`, `make backend` (recording HUD
      does not change backend contract apart from REQ-003's commit path);
      `make typecheck`.

## Evidence

- `bar_compact_controls` contract: `domain/settings.ts` L28–30 ("bar shows
  the dot + timer only and the popup carries pause/resume/stop; false = the
  bar carries the buttons itself").
- BackendPKG recording driver abstraction: `README.md` L5–6 (gpu-screen-
  recorder / wf-recorder swappable) — HUD must not assume a driver name.
