---
id: REQ-006
title: "Widen the S4 hover reveal to the full S1 bar footprint without intercepting clicks"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
  spike: SPIKE-001
worktree: .worktrees/REQ-006/
branch: ticket/REQ-006-hover-region-reveal
---

# Widen the S4 hover reveal region during recording (option C)

> Implemented from [SPIKE-001](../SPIKE-001-hover-region/ticket.md) option C.
> No tag, push or merge in this ticket.

## Requirement

While `bar.recording_hud = "hover"` and a recording is live, reveal the normal
S4 HUD when the pointer is anywhere over the **normal S1 bar footprint**, while
the hidden S4 window stays **unmapped** (zero input region) so clicks over that
area pass through to the application below. A revealed HUD is in the clip while
the pointer is interacting with it (D9 permits this); the first recorded frame
must stay clean when the pointer is still on the Record CTA.

## Acceptance

- [x] `hover` keeps the S4 window unmapped while chrome is hidden; only a
      revealed 76×38 (compact) / 243×46 (full controls) HUD maps. No hidden
      input surface, therefore no click interception.
- [x] The trigger footprint is captured from the real S1 allocation and
      position at commit (before `hideBar` re-measures it to S0), not a
      hardcoded 1546×54; top/bottom placement and target/option width changes
      follow the live geometry.
- [x] A 20 Hz (50 ms) compositor pointer poll runs only while the recording is
      live and `recording_hud = "hover"`. Primary source: persistent Hyprland
      command-socket client querying `j/cursorpos`; fallback:
      `hyprctl -j cursorpos`. Missing Hyprland/socket degrades to no reveal, no
      crash.
- [x] Pointer inside the cached S1 footprint maps the normal HUD and reveals
      chrome; outside unmaps it.
- [x] Arm-after-leave: when the pointer is already inside the footprint at
      commit (e.g. on the Record CTA), nothing reveals until it leaves once;
      normal enter/leave then applies.
- [x] Lifecycle: stop/error/idle, leaving `hover`, window destroy and app
      shutdown stop the poll, clear the cached footprint/reveal state and
      unmap the revealed HUD. No timer survives S4.
- [x] First frame is clean on a real region recording started with the pointer
      on the Record CTA; the HUD appears in the clip only during interaction.
- [x] Clicks over the hidden bar area reach the app below.
- [x] `make test`, `make conformance`, `make backend` and `make typecheck`
      pass on the branch.
- [x] REQ ticket, SPIKE-001 outcome, EPIC design §6 note and INDEX updated.

## Design

### Footprint source

`captureHoverFootprint()` runs inside the recording commit's `hideBar` closure,
while the window is still the S1 surface. It combines
`gdkmonitor.get_geometry()` with `window.get_width()/get_height()` and the actual
`margin_top`/`margin_bottom`; `domain/hover-region.ts#barFootprint` centres it
horizontally and anchors it to the configured edge. Reference host: the
Region+MP4 lane measured 1506×54 at `207,1026` in this run (the spike's T2
config was 1546×54 at `187,1026`), and the function reproduces both from their
allocations. Nothing measured is hardcoded.

### Poll mechanism

One `GLib.timeout_add(..., 50, ...)` per live capture window, started in
`enterLiveHud()` after the first clean `applyBarState()`. It calls
`ports.pointerPosition.current()`; `adapters/hyprland-pointer-position.ts`
reuses one `Gio.SocketClient` against
`$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket.sock` with
`j/cursorpos`, then falls back to a synchronous `hyprctl -j cursorpos`.
`domain/pointer-position.ts` parses the reply tolerantly and returns `null`, not
`(0,0)`, on malformed input.

The poll stops when the recording ends, when `recording_hud` stops being
`hover`, and on window destroy. The GTK motion controller defers to the poll in
hover mode, because the revealed HUD is only 76×38 while the trigger footprint
is the whole S1 lane: without that, leaving the small HUD would hide it even
though the pointer is still inside the lane.

### Arm logic

`domain/hover-region.ts#updateHoverReveal` returns
`{armed, inside, revealed}`. `armed` starts `false`; only an outside sample sets
it. Inside while unarmed stays hidden, so a commit from the Record CTA cannot
reveal the HUD in the first frame. Once outside, normal enter reveals and leave
hides. A null pointer/footprint hides without disarming; a transient read
failure cannot become an accidental reveal.

### Recording intent

A revealed HUD is inside the clip when the selection includes the bar; that is
D9's documented `hover` behaviour. This ticket does not add exclusion. The arm
guard is the only first-frame protection.

## Evidence

Live probe directory: `/tmp/opencode/capture-hover-c/`. The branch app was run
as an isolated AGS instance (`capture-hover-c`) with isolated
`XDG_CONFIG_HOME`/`XDG_STATE_HOME`; the user's `capture` instance and
`~/.config/capture-tool/config.json` were not modified. Temporary probe-only
edits in the `/tmp` copy set the instance name and initial S1 state.

- `screens/09-run2-hidden-on-cta-layers.json` — no `capture` layer 2 s after
  committing with the pointer on the Record CTA.
- `clips/hover-region-run2.mp4` — real 1398×618 Region+MP4 recording. Bottom
  crops `clips/run2-bottom-*.png` show frames 0.05–2.0 s clean, HUD at 2.5–5.0 s
  during interaction, clean again at 6.0 s.
- `screens/10-run2-revealed-layers.json` — `922 1042 76 38` revealed after
  leaving and re-entering; `screens/10-run2-revealed.png` shows the timer.
- `screens/11-run2-hidden-again-layers.json` — no `capture` layer after the
  pointer leaves.
- `click-result-2.txt` — a fullscreen GTK button behind the hidden bar received
  a click at `900,1053` inside the cached lane footprint; the click passed
  through before the poll revealed the HUD.
- `screens/12-run2-after-stop-layers.json`,
  `screens/14-run3-after-stop-layers.json`,
  `screens/16-run4-after-stop-layers.json` — no `capture` layer after stop.
- `run4-latency.txt` — move-to-mapped **20.3 ms** (50 ms poll budget), four
  `hyprctl layers -j` samples.

## Gates

All run on `ticket/REQ-006-hover-region-reveal` from
`.worktrees/REQ-006/`; logs in `/tmp/opencode/capture-req006-*.log`.

- `make test` → exit 0: 10/10 unit, 1/1 validation, **318/318** TypeScript
  (18 in the new hover-region suite), test `tsc` clean.
- `make conformance` → exit 0: **16/16**.
- `make backend` → exit 0: **114 passed**.
- `make typecheck` → exit 0: 0 errors in the ags-capture-tool tree (28
  tolerated `/usr/share/ags/js` errors, 0 platform errors).
- `make bundle` → exit 0: `build/capture.js`, 1,559,444 bytes.

## Outcome

Implemented on `ticket/REQ-006-hover-region-reveal`; no tag, push or merge.
`hover` hidden state is now unmapped and click-through; a 20 Hz socket poll
reveals the normal HUD over the full cached S1 footprint; stop/error/idle
unmaps and clears the poll. `always`/`hidden` presentation and capture controls
are unchanged. The live probe used an isolated app instance; the user's
`capture` instance, settings, wallpaper and pointer position were restored
afterwards.

Delivered in `v0.2.2` (tag at `759b539`, `PIN-0133` in `dotfiles-v3`
`33458fe3`), then refined by [REQ-007](../REQ-007-hover-smart-footprint/ticket.md)
(`v0.2.3`, `PIN-0134`) and [BUG-003](../BUG-003-hover-controls-collapse/ticket.md)
(`v0.2.4`, `PIN-0135`). JD accepted the hover series as baseline on 2026-11-04.
Evidence: `/tmp/opencode/capture-hover-c/`; this ticket's evidence section and
the BUG-003 live probe.
