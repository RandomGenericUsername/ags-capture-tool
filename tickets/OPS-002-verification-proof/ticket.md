---
id: OPS-002
title: "Close capture v0.2.0 verification debt (T2)"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Close capture v0.2.0 verification debt (T2)

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Work

Verification-only closeout of the three unmeasured claims from the v0.2.0
release, per the [release-record handoff](../EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md)
T2. No app code, tag, or deployed-pin change. The live app (PID 511294,
v0.2.0) was driven through its real UI; evidence was captured with
`grim`/`wf-recorder`/`gpu-screen-recorder` and the backend CLI.

1. Pending-selection overlay must not appear in the app's own recording
   (FR-10 / REQ-003:58).
2. `bar.recording_hud = hidden` → no capture-bar HUD in the clip;
   `always` → the S4 HUD is in the clip (REQ-004:303).
3. Backend `--geometry` / `--monitor` / `--window` are additive: legacy argv
   and the legacy `slurp` path still work (REQ-003:73, design §11.3).
4. `scale≠1` coordinate geometry: temporarily set `eDP-1` to 1.25, run one
   region pick, restore 1.0 (JD Q2=A).

## Done-when

The REQ-003 and REQ-004 proof boxes are ticked with artifacts; the `scale≠1`
check is measured (or documented as an environmental limitation); the host is
left with `recording_hud = hidden` and scale 1.0; no app code, tag, or deployed
pin changed.

## Evidence

Full commands, timestamps, frame-extraction commands and raw output:
[`evidence.md`](./evidence.md). Artifact root: `/tmp/opencode/capture-t2/`.

| Claim | Artifact / command | Observed |
|---|---|---|
| Pending chrome absent from app clip | `clips/pending-selection-app-region.mp4`, `...-2s.mp4`; frames `pending-app-*.png` | Recorder argv `-region 800x500+300+200`; frames at 0.05/0.2/0.5/1/2/4/7s show plain desktop — no dim, outline, handles, or badge |
| Pending chrome really was on screen | `screens/pending-selection-chrome.png`, `clips/pending-chrome-external.mp4` | Independent wf-recorder clip shows the dim/outline/handles, so the absence above is meaningful |
| HUD `hidden` | `clips/hud-hidden-screen.mp4` / `-2s.mp4`; `frames/hud-hidden-*.png` | No `capture` layer after commit; only the ags-bar top indicator; no bottom HUD |
| HUD `always` | `clips/hud-always-screen.mp4` / `-2s.mp4`; `frames/hud-always-*.png`; `screens/hud-always-mid2.png` | Bottom S4 HUD (`● 00:0N Pause ■ Stop`) present in every frame |
| Setting restored | `jq '.bar.recording_hud' ~/.config/capture-tool/config.json` | `"hidden"` (config byte-identical to baseline) |
| Backend legacy argv | `backend/screenshot-flags.log`, `backend/legacy-slurp-region.png` | `screenshot --target screen` exit 0 (1920x1080); interactive `slurp` region exit 0 (501x401) |
| Backend additive flags | `backend/screenshot-flags.log`, `backend/start-flags.log` | `--geometry` 320x200; `--monitor` 1920x1080; `--window` 1898x1014; `start --geometry` 320x200; `start --monitor` 1920x1080 |
| `scale≠1` geometry | `monitors-before.json`, `monitors-scale125.json`, `monitors-after.json`, `clips/scale125-region-pick.mp4`, `frames/scale125-region-1s.png` | Scale 1 → 1.25 → 1; logical pending rect 640x440 passed as `-region 640x440+280+160`; output 800x550 (×1.25); crop matches the selection; restored to 1.0 |
| Live app unchanged | `ps -o pid,lstart,cmd -p 511294`; deployed pin | PID 511294 throughout; pin still `v0.2.0` |

## Incidents / housekeeping

- **Wallpaper touched and restored:** a stray UI click opened the
  wallpaper-selector and applied `circuit.png`. It was immediately reverted to
  the pre-test `aurora_dragon.png` with `dotfiles-runtime wallpaper set`; the
  selector app (already running since 10:22) was restarted and its window left
  hidden. See `evidence.md` § Housekeeping.
- `~/.local/state/capture-tool/capture-ui.json` was restored to the observed
  pre-test last-used state.
- The scale-1.25 window lasted ~2 minutes; `hyprctl monitors -j` ends at
  scale 1.

## Follow-ups

- T3 (status/frontmatter/INDEX reconciliation) remains separate; this ticket
  only ticks the proof boxes.
- T5 cleanup (worktrees, installed v0.1.0) remains separate.
