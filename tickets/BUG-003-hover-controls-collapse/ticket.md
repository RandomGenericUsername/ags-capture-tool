---
id: BUG-003
title: "Hover-revealed recording controls unmap when moving to Pause/Stop"
kind: bug
status: done
lane: direct
severity: high
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-003/
branch: ticket/BUG-003-hover-controls-collapse
repro: "recording_hud=hover, bar_compact_controls=true; start a region recording; hover the resting bar (142x54) to reveal the HUD; click the HUD to open the Pause/Stop popover; move the pointer onto Pause or Stop."
observed: "The popover closes and the capture surface unmaps because the pointer poll compares only against the cached resting 142x54 rect; Pause/Stop sit above it (popover y=937..1029 vs bar y=1026..1080), so pointerInside becomes false and applyHudVisibility hides the window."
expected: "The expanded control surface stays mapped while the pointer is within it; Pause/Stop are clickable; leaving the whole active surface hides after a short grace and the hidden surface remains unmapped/click-through."
---

# Hover-revealed recording controls unmap when moving to Pause/Stop (v0.2.4)

> Bug fix for [REQ-007](../REQ-007-hover-smart-footprint/ticket.md) /
> [REQ-006](../REQ-006-hover-region-reveal/ticket.md) hover reveal. No tag,
> push or merge in this ticket.

## Repro

1. Set `bar.recording_hud = "hover"` (and `bar_compact_controls = true` for the
   popover path).
2. Start a region recording from the capture bar.
3. Hover the resting bar (`142x54` at `889,1026` here) until the HUD reveals.
4. Click the HUD status to open the Pause/Stop popover.
5. Move the pointer onto Pause or Stop.

Live probe of the pre-fix branch (v0.2.3) is recorded by the same steps; the
post-fix probe below is `/tmp/opencode/capture-hover-controls/`.

## Observed

The v0.2.3 poll tested the pointer only against `hoverFootprint`, the cached
resting bar rect captured at commit:

- `ui/classic/ClassicWindow.tsx:271-275` (v0.2.3) —
  `updateHoverReveal(hoverReveal, pointer, hoverFootprint)`.
- `ui/classic/ClassicWindow.tsx:679` — `hoverFootprint =
  captureHoverFootprint()` at commit, i.e. the 142x54 resting bar, not the
  revealed/expanded surface.
- `domain/hover-region.ts:233-235` — any point outside that rect returns
  `revealed: false`.
- `ui/classic/ClassicWindow.tsx:404,411-415` — when chrome hides it pops the
  popover down and unmaps the window, so the next click cannot land.

The compact popover is **220x92 at `850,937`** while the resting bar is
**142x54 at `889,1026`**. Pause/Stop are at y≈995, above the resting rect's
top edge (1026), so the controls vanish as the pointer moves onto them.

## Expected

The active trigger follows the surface that is actually visible: resting bar
while hidden, the mapped HUD when revealed, and the expanded popover when open.
Leaving that active surface hides after a short grace (200 ms) so crossing a
1 px gap or moving between controls does not flicker. A press on a control
keeps the surface mapped until release, and a hidden surface stays unmapped and
click-through.

## Fix notes

### Root cause

REQ-007 correctly narrowed the initial reveal from the S1 option lane
(1506x54) to the resting bar (142x54). That narrowing was then used as the
**permanent** trigger for the whole hover lifetime. It is correct only before
reveal: once the HUD is mapped, the visible surface is the compact HUD
(76x38), the compact popover (220x92), or the non-compact Pause/Stop lane
(243x46), none of which is contained by the resting rect in every direction.
The poll therefore reported "left" while the pointer was still on a control.

### Fix rule

Each 50 ms tick now computes the trigger as the union of:

1. the cached resting bar rect (`hoverFootprint`) — preserves the exact
   REQ-007 initial trigger;
2. the **current mapped bar/HUD rect** (`window.get_width()/get_height()`),
   included only while the surface is mapped or currently revealing; and
3. the open popover's actual surface rect (`Gdk.Popup.get_position_x/y` plus
   its width/height, relative to the bar surface).

`domain/hover-region.ts#unionHoverRects()` owns the union and ignores
zero/invalid rects, so an unmeasured expansion cannot widen the trigger. If the
popover geometry is unavailable, the poll holds the reveal while the popover
is open (the documented fallback) instead of inventing a rect. The active rect
is never the 1506x54 S1 lane.

`domain/hover-region.ts#applyHoverLeaveGrace()` adds the 200 ms leave grace and
the `holding` guard. `ui/classic/ClassicWindow.tsx#watchHudPress()` sets that
guard from `Gtk.GestureClick` press/release on the HUD row and popover, so a
slow click cannot lose its own surface. Arm-after-leave and first-frame
cleanliness are unchanged: the first inside sample is still disarmed until an
outside sample, and the hidden window is still unmapped.

### Regression tests

Added 6 pure tests plus a source-wiring test in
`tests/ts/hover-region.test.ts`:

- active union tracks resting + expanded and ignores invalid rects;
- moving from resting onto expanded controls stays revealed (resting-only
  control case asserts the old behaviour hid it);
- leaving expanded hides only after the 200 ms grace, then stays hidden;
- re-entry during grace cancels the hide (no 1 px-gap flicker);
- a held control stays mapped past the grace until release;
- collapse returns the trigger to the resting rect; and
- source wiring pins the current rect, popover geometry, union, grace and
  press guard.

## Evidence

Live probe: `/tmp/opencode/capture-hover-controls/`. Isolated AGS instance
`capture-hover-controls`, isolated `XDG_CONFIG_HOME`/`XDG_STATE_HOME`; the
user's `capture` instance and `~/.config/capture-tool/config.json` were not
modified. Hyprland 0.56.2, eDP-1 1920x1080 scale 1.

### Measurements (`hyprctl layers`, text captures in `screens/`)

| State | Surface | Geometry |
| --- | --- | --- |
| S0 resting bar | capture | `889 1026 142 54` (`01-s0-layers.txt`) |
| S1 recording lane before commit | capture | `207 1026 1506 54` (`09-recording-lane-layers.txt`) |
| Compact HUD revealed | capture | `922 1042 76 38` (`12-revealed-layers.txt`) |
| Compact Pause/Stop popover | GTK popup (not a layer-shell layer) | `850 937 220 92` from `screens/13-popup.png` border scan |
| Non-compact Pause/Stop lane revealed | capture | `839 1034 243 46` (`33-noncompact-revealed-layers.txt`) |

**Answer to the release question:** the expanded non-compact bar is **243x46**,
not 1506; the compact expanded surface is the 220x92 popover over the 76x38
HUD. The 1506x54 S1 option lane is still not a trigger.

### Interaction (compact popover)

- `12-revealed.png` / `13-popup.png`: hover reveals the HUD, click opens the
  popover.
- `14-pointer-pause.png` and `16-pointer-pause2.png`: pointer on Pause keeps
  the capture layer mapped (`922 1042 76 38`) and the popover visible.
- `17-paused.png` + hub topic `state=paused`, same mapped layer: Pause click
  completed without an unmap.
- `18-after-stop.png` / `19-after-stop2.png` + hub topic `state=idle` and no
  `capture` layer: Stop click completed and the surface unmapped.
- `33-noncompact-revealed.png` + `34-noncompact-paused-layers.txt`: in
  non-compact mode the expanded 243x46 lane stays mapped and Pause works.
- `27-run2-hidden-outside-layers.txt` (no `capture` layer) → click-through
  `click-result.txt` (`clicked 1793820187.5242815`) with
  `press_at.py` → `28-run2-clickthrough-layers.txt` shows the HUD only mapped
  after the click. Hidden state intercepted nothing.
- First frame clean: `23-run2-hidden-layers.txt` has no `capture` layer while
  the pointer is on the Record CTA; app-recording frames
  `clips/app-frame-0.05/0.5/1/2/3.png` and
  `clips/app-first-frames-montage.png` show no HUD.
- Screen clip: `clips/interaction.mp4` (104.8 s), montage
  `clips/interaction-montage.png`; recording artifact
  `recordings/recording_2026-11-04_14-20-17.mp4`.

### Restoration

Probe instance quit; user's `capture` instance restarted (`pid` recorded in
`restore-capture.pid`), bar back at S0 `889 1026 142 54`, pointer restored to
`631,636` (start `631,636`; final `630,635`), user config unchanged
(`recording_hud=hover`, `bar_compact_controls=true`).

## Gates

All run on `ticket/BUG-003-hover-controls-collapse` from `.worktrees/BUG-003/`;
logs in `/tmp/opencode/capture-hover-controls/`.

- `make test` → exit 0: 10/10 unit, 1/1 validation, **331/331** TypeScript
  (7 new hover tests), test `tsc` clean.
- `make conformance` → exit 0: **16/16**.
- `make backend` → exit 0: **114 passed**.
- `make typecheck` → exit 0: 0 errors in the ags-capture-tool tree (28
  tolerated `/usr/share/ags/js` errors, 0 platform errors).

## Outcome

Implemented on `ticket/BUG-003-hover-controls-collapse`; no tag, push or
merge. The hover poll now follows the current visible bar rect plus the open
popover, with a 200 ms leave grace and a press guard. The initial hidden
trigger is still the exact REQ-007 resting bar; hidden remains unmapped and
click-through. Live probe confirmed Pause and Stop are clickable in both
compact and non-compact modes, leaving hides, and click-through still works.

## JD baseline acceptance (2026-11-04)

JD signed off the hover interaction as the accepted baseline:

- Hover reveals the cluster; click expands; controls stay mapped and Pause/Stop
  work.
- Clicking outside collapses it.
- Hidden remains click-through; the first frame remains clean when starting
  from the Record CTA.

Live deploy: `v0.2.4` (tag at `ce56c80`), deployed pin `PIN-0135`
(`dotfiles-v3` `1141e6f7`), active app
`~/.local/share/dotfiles/apps/capture/v0.2.4`. Docs-only closeout; no code,
tag, pin or deployed-state change in this ticket.

## Risk

- The active union includes the mapped HUD and popover only while they are
  visible, so the hidden trigger cannot widen back to the S1 lane.
- Popover geometry is read from the GTK popup surface; if that is unavailable,
  the fallback holds the surface while the popover is open. A pointer moving
  far away with the popover still open stays mapped until the popover closes —
  the documented fallback, not an invented rectangle.
- The press guard is per-window and resets on unmap/destroy; no global state is
  introduced.
- Hyprland-specific pointer polling is unchanged from REQ-006/REQ-007.
