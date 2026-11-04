---
id: REQ-007
title: "Derive the S4 hover footprint from the configured bar rectangle, not the S1 window"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
  spike: SPIKE-001
worktree: .worktrees/REQ-007/
branch: ticket/REQ-007-hover-smart-footprint
---

# Derive the S4 hover footprint from the configured bar rectangle (v0.2.3)

> Refinement of [REQ-006](../REQ-006-hover-region-reveal/ticket.md) and
> [SPIKE-001](../SPIKE-001-hover-region/ticket.md) option C. No tag, push or
> merge in this ticket.

## Requirement

While `bar.recording_hud = "hover"` and a recording is live, reveal the normal
S4 HUD only when the pointer is over the **configured resting bar** (the S0
`.capture-bar.rail`), not the much wider S1 lane window that happened to be
allocated at Record time. The hidden S4 surface stays unmapped and click-through
exactly as in v0.2.2; only the trigger rectangle narrows.

JD measured the S1 window at 1506×54 on 1920 and reported that the trigger feels
about **35% too wide on each side**. `(1506 − 142) / 2 = 682 px`, which is
**35.5% of 1920**: the surplus is the S1 option lane, not the bar. The resting
bar on this host is **142×54** at `(889,1026)`.

## Acceptance

- [x] The footprint uses the measured resting-bar rectangle (142×54 here), not
      `captureWindow.get_width()/get_height()` (1506×54) when a resting-bar
      measurement exists.
- [x] Placement follows `bar.position`, `bar.offsetPx`/margins, the monitor
      origin and the monitor's logical geometry at commit; top/bottom and
      offset changes move the rect.
- [x] A stale measurement from another monitor never reveals: the cached bar
      connector must equal the capture window's monitor connector, else the
      footprint is `null`.
- [x] Only the bar rect triggers. A dock or another surface in the same edge
      band is outside the rect and does not reveal.
- [x] Tolerance is explicit and defaults to exact: `HOVER_TOLERANCE_PX = 0`
      (the literal-bar choice). The pure grow helper is still tested for a
      future 1–4 px tweak.
- [x] Measurement failure falls back to the v0.2.2 window-based footprint
      instead of disabling the reveal.
- [x] Arm-after-leave guard, 50 ms poll lifecycle, unmapped hidden surface and
      every other v0.2.2 behaviour are unchanged.
- [x] `make test`, `make conformance`, `make backend` and `make typecheck`
      pass on the branch.
- [x] REQ ticket, INDEX, design note and v0.2.3 changelog updated.

## Design

### Measurements (live probe)

`hyprctl layers` and temporary GTK allocation logging on an isolated
`capture-hover-smart` instance, eDP-1 1920×1080 scale 1:

| State | Window | Visible bar child |
| --- | --- | --- |
| S0 resting rail | 142×54 at `889,1026` | `.capture-bar.rail` 142×54 |
| S1 recording lane | 1506×54 at `207,1026` | `.capture-bar.open` 1506×54 (content 1492×40, border box 1506×54) |

The window is **not** padded beyond the visible S1 row on this host; the width
JD feels is real S1 content (the option pills), not layer-surface slack. The
bar that should own the reveal is the S0 rail: v0.2.2 cached the S1 lane because
that was the visible row at commit, so 682 px of empty bottom edge on each side
also revealed the HUD.

### Footprint rule

`captureHoverFootprint()` reads the last measured **resting rail** size from
`syncWindowSize()` while the bar is home (S0). At recording commit it combines
that size with the *current* `gdkmonitor.get_geometry()`, `bar.position` and
the window's actual `margin_top`/`margin_bottom`, so placement and offset still
follow the config. `domain/hover-region.ts#hoverBarSize()` validates the
measurement, rejects a connector mismatch, and falls back to the window size if
no valid bar size exists. `barFootprint()` centres the bar (the window's real
`halign = CENTER` contract) and anchors it to the configured edge.

Coordinates are logical throughout: `Gdk.Monitor.get_geometry()`, GTK widget
allocations and Hyprland `cursorpos` all use logical layout pixels, so a scale
of 1.25/1.5 must not be multiplied again. Tests pin a logical 1280×720 monitor
(1920 physical at 1.5) at a non-zero origin.

Tolerance: **0 px**. The trigger is the exact resting-bar rect; the
`growHoverRect()` helper is unit-tested for an optional 1–4 px expansion but is
called with `HOVER_TOLERANCE_PX = 0`.

### Monitors and docks

Each `ClassicWindow` owns one `Gdk.Monitor`, and the cached rail carries that
monitor's connector. At commit the connector must still match; a mismatch
returns `null` (no reveal) rather than reusing a rectangle from another output.
Because the trigger is a single 142×54 rect, nothing else on the edge band — a
dock, a full-width overlay, or the empty space where the S1 lane used to be —
can trigger it.

## Evidence

Live probe: `/tmp/opencode/capture-hover-smart/`. Isolated AGS instance
`capture-hover-smart` with isolated `XDG_CONFIG_HOME`/`XDG_STATE_HOME`; the
user's `capture` instance and settings were not modified.

- `screens/01-s0-layers.json` — S0 rail layer `889 1026 142 54`.
- `screens/02-s1-layers.json` — S1 lane layer `207 1026 1506 54` (plus the
  full-screen selection overlay).
- `app2.log`: `SMART_FOOTPRINT resting=eDP-1:142x54 window=1506x54
  size=142x54 footprint=889,1026,142,54`. This is the commit-time trigger:
  142 px, not 1506.
- `screens/09-probe-hidden-layers.json` — no `capture` layer after commit
  while the pointer is on the Record CTA (outside the narrow bar rect).
- `screens/10-inside-layers.json` — pointer `960,1053` (inside `889..1031`):
  `capture` HUD layer `922 1042 76 38`; `screens/10-inside-revealed.png`.
- `screens/12-left-outside-layers.json` — pointer `880,1053` (1 px left of the
  bar): no `capture` layer.
- `screens/13-right-outside-layers.json` — pointer `1040,1053` (1 px right of
  `1031`): no `capture` layer.
- `screens/14-inside-again-layers.json` — re-entry at `960,1053` reveals again.
- `screens/15-right-outside-again-layers.json` — right-outside hides again.
- `click-result-smart.txt` — `clicked …`: a fullscreen GTK probe received a
  click at `960,1053` while the HUD was unmapped. `press_at.py` emits the move
  and button in one batch, before the 50 ms poll; `screens/16-clickthrough-layers.json`
  shows the HUD mapped only after that click.
- `screens/23-after-stop-layers.json` — no `capture` layer after stopping the
  recording through the hub `Control(..., "stop")`; the poll/footprint is gone.
- Implementation commit: `cff4d9f7af5947da403b867715b6784692dea768`.
- Gate logs: `/tmp/opencode/capture-hover-smart/gate-{test,conformance,backend,typecheck}.log`.

The probe used a full-screen recording target (real `Record` CTA commit) because
the region drag is independent of the hover trigger. `recordings/recording_2026-11-04_14-01-26.mp4`
is the live artifact.

## Gates

All run on `ticket/REQ-007-hover-smart-footprint` from `.worktrees/REQ-007/`;
logs in `/tmp/opencode/capture-hover-smart/`.

- `make test` → exit 0: 10/10 unit, 1/1 validation, **324/324** TypeScript
  (24 in the hover-region suite, including 6 new bar-rectangle cases), test
  `tsc` clean.
- `make conformance` → exit 0: **16/16**.
- `make backend` → exit 0: **114 passed**.
- `make typecheck` → exit 0: 0 errors in the ags-capture-tool tree (28
  tolerated `/usr/share/ags/js` errors, 0 platform errors).

## Outcome

Implemented on `ticket/REQ-007-hover-smart-footprint`; no tag, push or merge.
The `hover` trigger is now the configured resting bar (142×54 at `889,1026` on
the reference host) instead of the S1 option window (1506×54). Placement,
offset, monitor origin and a resized rail follow the config at commit; a
cross-monitor cache returns no region; the exact-rect tolerance is 0 px; a
failed measurement falls back to the v0.2.2 window footprint. The live probe
confirmed reveal inside the bar rect and no reveal 1 px outside horizontally
(880 and 1040 vs the rect's `889..1031`), hide on leave, click-through while
hidden and no surface after stop. The isolated probe
instance was stopped and the pointer restored; the user's `capture` instance and
settings were untouched.
