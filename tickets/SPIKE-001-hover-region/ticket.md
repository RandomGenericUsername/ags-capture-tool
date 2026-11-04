---
id: SPIKE-001
title: "Widen the S4 hover reveal region during recording"
kind: spike
status: reported
lane: bmad-advisory
timebox: "2h"
questions:
  - "Can the mapped S4 surface/input region be widened to the full normal bar footprint while chrome is at opacity 0, without intercepting clicks?"
  - "If interception cannot be avoided, can a pointer-position trigger reveal the HUD without a mapped input area?"
  - "If the HUD is revealed during recording, does it appear in the clip, and is that the design intent?"
answered:
  - "The S4 surface can be widened, but a hoverable pixel is an input pixel on Wayland: there is no hover-only region. A full-footprint map intercepts every click in that footprint."
  - "GDK has Gdk.Surface.set_input_region (the gtk4-layer-shell library does not); it can shape a mapped surface but cannot make an input region both hover-sensitive and click-through."
  - "A pointer-position poll (hyprctl cursorpos / Hyprland command socket) can drive a full-footprint reveal while the window stays unmapped, so hidden state is fully click-through. 10–20 Hz is enough; measured cost is negligible on the socket path."
  - "A revealed HUD is recorded if the capture includes the bar; design D9 explicitly accepts this for hover ('recordings contain it only during interaction'). The first frame needs an arm-after-leave guard when the trigger includes the Record CTA."
open:
  - "Live proof that mapping/unmapping the 76×38 S4 HUD at 10–20 Hz feels stable (no flicker, no focus stealing) is not run; budget ~30 min before implementation."
  - "Exact S1 footprint varies with target/options; measure the live lane before hard-coding the poll region. T2 measured 1546×54 for Region+MP4; S0 is 142×54 and the compact S4 HUD is 76×38."
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Widen the S4 hover reveal region during recording

> **Status: reported 2026-11-04.** Design/evidence only; no app code, tag,
> release or deployed-pin change. Spike stopped at the box.

## Questions

1. Can the mapped S4 surface/input region be widened to the bar's full normal
   footprint while chrome is opacity 0, without breaking recording UX?
2. If the surface cannot be both hoverable and click-through, what
   no-interception trigger can reveal the bar?
3. In `hover` mode, does a revealed HUD land in the recording, and is that
   intended?
4. Which option gives the best behavior/effort/risk trade, and what exact
   decision does JD have to make?

## Findings

### 1. Geometry and input — widening is possible, click-through is not

**Current behavior.** `hover` returns `{ mapWindow: true, showChrome:
pointerInside }` (`domain/recording-hud.ts:95-110`). The S4 window is sized by
measuring the visible child (`ui/classic/ClassicWindow.tsx:134-145`) and is
mapped with `hudRow.opacity = 0` until pointer entry
(`ui/classic/ClassicWindow.tsx:250-272`). The only child visible in S4 is the
HUD row (`applyBarState`, `ui/classic/ClassicWindow.tsx:378-402`).

**Measured sizes on eDP-1, 1920×1080, scale 1:**

| Surface | Geometry | Evidence |
|---|---|---|
| S0 rail | `142×54` at `889,1026` | `/tmp/opencode/hover-probe/README.md`; live `hyprctl layers` |
| S4 hover HUD, compact controls | `76×38` at `922,1042` | same probe; `bar_compact_controls = true` |
| S4 HUD, full controls | `243×46` at `839,1034` | `/tmp/opencode/capture-t2/EVIDENCE.md` §2 |
| S1/S3 recording lane (Region+MP4) | `1546×54` at `187,1026` | `/tmp/opencode/capture-t2/screens/pending-selection-layers.json`; also `screens/bar-s1-recording.png` |

So "the full normal bar region" is the **1546×54** lane footprint, not the
76×38 HUD: 83,484 logical px², **4.0% of the 1920×1080 output**, spanning
~80.5% of the screen width across the bottom 54 px.

**What controls input.** On Wayland, a mapped surface receives pointer events
over its whole surface by default; `opacity = 0` is purely visual. Widget-level
`set_can_target(false)` (`ui/overlay/SelectionOverlay.tsx:57-60`) shapes widget
hit-testing **inside** a surface; it does not pass the surface's events through
to the window below. Click-through is a surface input-region property.

**Correction to the repo's "no input-region API" statement.** gtk4-layer-shell
1.3.0 has no input-region API in its own GIR (`/usr/include/gtk4-layer-shell/
gtk4-layer-shell.h:324` points at issue #61), and that is what
`design.md:268-281` and `ui/overlay/SelectionOverlay.tsx:4-5` record. **GDK
itself does provide it:** `Gdk.Surface.set_input_region(region)`
(`@girs/gdk-4.0.d.ts:23867`) with
`Gdk.Display.supports_input_shapes()` (`@girs/gdk-4.0.d.ts:18381`). An AGS
window can reach its surface after `present()` through
`Gtk.Native.get_surface()` (`@girs/gtk-4.0.d.ts:9150`), and GJS can build a
`cairo.Region`. The gtk4-layer-shell maintainer confirms this works on
layer-shell surfaces in <https://github.com/wmww/gtk4-layer-shell/issues/61>.

**But this does not unlock option A.** An input region can only include or
exclude pixels. Pixels that receive pointer **enter/motion** are the same
pixels that receive **button** events; the protocol has no "hover but
pass clicks" shape. Widening the hover area therefore necessarily swallows
clicks in that area. Shaping the region smaller only shrinks both together.

**Risk quantification for option A.** A full-footprint S4 map intercepts
~1546×54 px = ~4.0% of the screen for the entire recording. Clicks in the
bottom-centre band never reach the app below. That is ~20× the clickable area
the HUD actually needs (76×38 compact / 243×46 full controls). It is a real
regression, not a theoretical one.

**First-frame hazard.** If the user clicks the `Record` CTA, the pointer is
inside the S1 footprint when S4 begins. A full-footprint trigger is therefore
already true at commit, so the HUD would reveal immediately and could land in
the first recorded frames. The current 76×38 shape avoids this accidentally
because the CTA is outside it. Any full-footprint option needs an
**arm-after-leave** rule (reveal only after the pointer has been outside the
trigger once since S4 started) or an equivalent guard.

Evidence commands:

```sh
cd /home/inumaki/Development/dotfiles/ags-capture-tool
hyprctl layers
hyprctl cursorpos
cat /tmp/opencode/capture-t2/screens/pending-selection-layers.json
identify /tmp/opencode/capture-t2/screens/bar-s1-recording.png
sed -n '95,110p' domain/recording-hud.ts
sed -n '250,272p' ui/classic/ClassicWindow.tsx
sed -n '680,700p' ui/classic/ClassicWindow.tsx
```

### 2. Alternative triggers — pointer polling works; socket2 does not carry motion

- **Hyprland event socket (`.socket2.sock`) has no pointer-motion event.** The
  official list is workspace/focusedmon/activewindow/fullscreen/openwindow/
  openlayer/… — no cursor or motion event
  (<https://wiki.hypr.land/IPC/>). It cannot drive hover reveal directly.
- **`hyprctl cursorpos` works and is cheap enough.** Measured on this host:
  50 `hyprctl cursorpos` calls in 0.176 s (≈3.5 ms each); 200 direct Unix-socket
  requests to `$XDG_RUNTIME_DIR/hypr/$HIS/.socket.sock` took 0.002 s total
  (≈0.009 ms/query). A 100 ms poll (10 Hz) has ≤100 ms reveal latency; 50 ms
  (20 Hz) is still negligible on the socket path. Spawning `hyprctl` at 20 Hz
  costs ≈7% of one core, so the socket path is preferable.
- **Reveal without a mapped input area.** While hidden, keep the S4 window
  unmapped (zero input region). Poll the global pointer and compare it with the
  cached S1 footprint for this monitor. On entry, map the normal 76×38 HUD and
  set `showChrome = true`; on exit, unmap it. Hidden state is fully
  click-through; only the visible HUD is clickable. An arm-after-leave guard
  keeps the first frame clean.
- **Persistent affordance.** A faint dot/timer/border makes the target
  discoverable without polling, but it is recorded whenever the bar is in
  frame. That conflicts with D9's clean-video intent and with `hover`'s
  "chrome only during interaction" wording. It also does not make the old CTA
  position work unless the hit strip is widened, which reintroduces
  interception.
- **Pointer events on a separate sensor surface** do not help: any surface
  that receives hover receives clicks too.

### 3. Recording surface — HUD-in-clip is intended for hover

If the revealed HUD is inside the recorded screen/region, it appears in the
clip. That is design intent, not a bug: D9 defines `hover` as "the HUD renders
only while the pointer is over the bar area (recordings contain it only during
interaction)" (`tickets/EPIC-001-capture-bar-redesign/design.md:47,166-167`),
and §6 repeats "In `hover`, the bar window stays mapped (hit-area present,
chrome hidden) so pointer entry reveals Pause/Stop"
(`design.md:166-174`). `always` is the mode that knowingly records the HUD;
`hidden` remains the zero-chrome mode.

The one conflict is the **first frame**: C3's clean-first-frame observation
relied on the pointer being outside the 76×38 HUD at commit. A full-footprint
trigger includes the CTA, so the implementation must arm after a leave (or
apply a grace period) or it will put the HUD in the opening frames. That is an
implementation rule, not a contradiction of D9.

### 4. Options

| # | Behavior | Click-through impact | Recording impact | Implementation footprint | Effort | Risk |
|---|---|---|---|---|---|---|
| **A** | Map S4 at the full cached S1 footprint (≈1546×54); chrome opacity 0; reveal on enter | **Bad.** Swallows every click in ~1546×54 px (~4.0% of screen) for the whole recording. GDK input-region shaping can resize this area but cannot make hovered pixels click-through. | HUD may appear immediately at commit (pointer on CTA) and in the first frames unless arm-after-leave is added. During interaction, same as intended hover. | Cache the pre-S4 lane size (or add a hidden spacer), size the S4 window to it; add arm/leave guard; tests. `ui/classic/ClassicWindow.tsx` + a pure helper. | 2–3 h | **High** UX regression; surprising invisible dead zone. |
| **B** | Moderate hit strip (e.g. 300×54 centred) + persistent faint affordance (dot/timer) | Moderate but still real; a 300×54 strip is ~16k px² and swallowed. The old CTA at the lane's right edge still misses the strip. | The persistent affordance is in every frame that includes the bar, conflicting with D9's clean-video intent. | CSS affordance + strip sizing/reveal; `style.css`, `ClassicWindow.tsx`, maybe visibility rule. | 2–3 h | Medium: doesn't solve the reported CTA-position miss; adds chrome to clips. |
| **C** (recommended) | Keep S4 unmapped while hidden; poll `cursorpos` at 10–20 Hz; compare against the cached S1 footprint; map the normal HUD and reveal on entry; unmap on exit; arm after first leave | **None while hidden.** Only the visible HUD (76×38 / 243×46) is clickable. Pointer can be anywhere over the full 1546×54 footprint; clicks outside the HUD pass through. | HUD appears only while the pointer is in the trigger, same as D9 hover; arm-after-leave keeps the first frame clean. | New pointer-position port + Hyprland socket adapter; pure `pointerInHoverRegion`; start/stop poll in `enterLiveHud`/`leaveLiveHud`; tests. Files: `ports/`, `adapters/`, `domain/`, `ui/classic/ClassicWindow.tsx`. | 4–6 h | Medium complexity; Hyprland-specific (already true for this app); 50–100 ms reveal latency; poll lifecycle must stop on S4 exit and not duplicate across monitors. No API blocker. |
| **D** | Keep 76×38; rename the Setting / add tooltip or help text / never widen | None | None | Setting label/help text only. | <1 h | Low, but does not fix the reachability complaint; JD still has to find a 76×38 invisible target. |

### Recommendation

**Option C.** It is the only option that satisfies the actual request — reveal
when the pointer is anywhere over the full normal bar footprint — while
preserving click-through and keeping chrome out of the recording until the user
interacts. Option A is the smallest code change but trades a core interaction
(bottom-of-screen clicks) for discoverability; on a 1920 px output it creates a
~1546×54 px invisible dead zone for the entire recording. Option B still
misses the old CTA position and adds persistent chrome to clips. Option D
sidesteps the question.

Implementation sketch (for the follow-up task, not this spike):

1. Cache the pre-S4 bar rect (the lane is measured at 1546×54 in T2; the exact
   width varies by target/options, so measure at `enterLiveHud` time).
2. While `recording_hud = hover` and S4 live, start a ~50–100 ms timer that
   reads `cursorpos` from the Hyprland command socket (one shared poller, not
   one per monitor).
3. Pure helper: `pointerInHoverRegion(cursor, monitorGeometry, barRect)`.
4. On entry: map/present the S4 window (normal HUD size) and set chrome
   visible. On exit: hide chrome and `hideCaptureWindow()`.
5. Arm after leave: do not reveal on S4 entry if the pointer is already inside
   the footprint (covers the click-Record CTA case); require one outside
   sample first.
6. Stop the timer on `leaveLiveHud`, hub restart, window destroy, and when the
   mode is not `hover`.

## Exact decision for JD

**Approve option C:** while `bar.recording_hud = "hover"`, use a low-rate
Hyprland `cursorpos` poll to detect the pointer anywhere over the normal S1 bar
footprint and reveal the S4 HUD without mapping a click-blocking surface
(hidden state stays fully click-through; reveal is armed only after the pointer
leaves once so the first recorded frame is clean).

If JD prefers no compositor polling, the alternative is **option A** and an
explicit acceptance that an invisible ~1546×54 strip swallows clicks during
recording; **option D** is the zero-risk fallback that leaves the 76×38 target
as-is.

## Blocker

**None for option C.** No input-region API is required. The only unverified
piece is a ~30-minute live check that repeated map/unmap of the HUD is stable
(no flicker/focus steal); if that check fails, fall back to keeping the window
mapped with an empty/shaped input region while polling (still no click
interception outside the HUD).

## Evidence and timebox

- Spike time used: ~1.5 h of the 2 h box (read-only source/design/API review,
  live geometry inspection, and `cursorpos` latency benchmark). No app code,
  tags, release or pin changes.
- Live state after investigation: capture `v0.2.1`, PID 902796, `recording_hud
  = "hover"`, bar at S0; no recording started; no config changed.
