# T2 verification evidence — capture v0.2.0

Date: 2026-11-04 (America/New_York)
Host: Hyprland 0.56.2 on Wayland `wayland-1`, single output `eDP-1`
1920x1080@144, scale 1 before/after the scale test.
Live app: `ags run -d /home/inumaki/.config/ags-capture`, PID **511294**, v0.2.0
(deployed pin unchanged). Evidence dir: `/tmp/opencode/capture-t2/`.

Interaction harness (not app code): `/tmp/opencode/capture-t2/tools/uid.py`,
a small `/dev/uinput` absolute-pointer/keyboard injector used to drive the real
app. No application code, tag, or deployed pin was changed.

Baseline `~/.config/capture-tool/config.json` (the only setting touched was
`bar.recording_hud`, restored to `hidden`; the file is byte-identical to the
baseline at the end):

```json
{"screenshot_dir":"~/Pictures/Screenshots","recording_dir":"~/Videos/Recordings",
 "filename_pattern":"{kind}_%Y-%m-%d_%H-%M-%S","notifications":true,
 "bar_compact_controls":false,
 "bar":{"position":"bottom","offsetPx":0,"recording_hud":"hidden"},
 "screenshot":{"format":"png","output":"clipboard","cursor":false},
 "recording":{"fps":60,"quality":"high","audio":"system","cursor":false}}
```

---

## 1. Pending-selection overlay is not in the app recording (FR-10 / REQ-003:58)

### Setup and pending-selection proof

The recording page was set to **Region + MP4**, then a pending rect was drawn
with the real overlay. The resulting geometry was `800x500+300+200`
(see the gpu-screen-recorder argv in `ps` below).

- `screens/pending-selection-chrome.png` — full-screen grim **while the rect is
  still uncommitted**. It shows the dim, the outline, the 8 handles, and the
  `800×500 editable` badge.
- `screens/pending-selection-layers.json` — `hyprctl layers -j` while pending;
  the overlay is a full-screen `capture` layer at `0,0 1920x1080` and the bar
  is the second `capture` layer at `187,1026 1546x54`.

### Control: an external recorder DOES see the chrome

While the pending selection was still visible, an independent recorder was
run for ~3s:

```sh
timeout -s INT 3 wf-recorder -o eDP-1 -f clips/pending-chrome-external.mp4
# exit=124 (timeout sent SIGINT); duration 2.957389s
```

`frames/external/pending-chrome-1s.png` and its crop
`frames/external/pending-chrome-same-region.png` show the dim, outline,
handles, and badge. This proves the chrome is on-screen and recordable at that
moment, i.e. the check is not vacuous.

### App recording after commit

`Record` was clicked at **2026-11-04T11:16:06-05:00**. The app committed the
pending selection and started its own recorder:

```text
dotfiles-runtime capture --backend gpu-screen-recorder --command
gpu-screen-recorder -w region -region 800x500+300+200 -c mp4 -f 60 ...
  -o /home/inumaki/Videos/Recordings/recording_2026-11-04_11-16-07.mp4
```

The recording was stopped from ags-bar; final file:
`/home/inumaki/Videos/Recordings/recording_2026-11-04_11-16-07.mp4`,
800x500, duration 7.8065s. Stable copies:

- `clips/pending-selection-app-region.mp4` (full recording)
- `clips/pending-selection-app-region-2s.mp4` (first 2.000s)
- `frames/pending-app-0.05.png`, `...0.2`, `...0.5`, `...1.0`, `...2.0`,
  `...4.0`, `...7.0` — extracted with:

```sh
ffmpeg -loglevel error -y -ss <t> -i clips/pending-selection-app-region.mp4 \
  -frames:v 1 frames/pending-app-<t>.png
```

Inspection result: every extracted frame, **including the first frame at
0.05s**, is the plain selected desktop region; there is no dim, no outline, no
handle, and no `editable` badge. `frames/pending-app-2s-montage.png` compares
0.2s and 2.0s. `frames/pending-selection-diff.png` puts the external control
crop (chrome visible) beside the app recording frame (same 800x500 region,
chrome absent).

Conclusion: the overlay was hidden synchronously before the recorder's first
frame; the app's own clip contains no selection UI. **Proven.**

---

## 2. HUD `hidden` vs `always` (REQ-004:303)

Both clips are full-screen (`-w eDP-1`), 1920x1080, and were stopped from
ags-bar (hidden mode) or the S4 HUD (always mode). The top-of-screen ags-bar
recording indicator is expected in both: D9 makes ags-bar the sole automatic
indicator while `hidden`.

### `recording_hud = hidden` (baseline)

- Commit **2026-11-04T11:17:11-05:00**; stop **11:17:14-05:00**.
- Full file `/home/inumaki/Videos/Recordings/recording_2026-11-04_11-17-12.mp4`
  (28.150s). Stable copies: `clips/hud-hidden-screen.mp4` and
  `clips/hud-hidden-screen-2s.mp4` (2.000s).
- Frames: `frames/hud-hidden-0.1.png`, `...1.0.png`, `...1.9.png`.
- `hyprctl layers` after commit shows **no `capture` layer at all** (only
  `gtk4-layer-shell` = ags-bar and `hyprpaper`).
- Inspection: the bottom of every frame is clean; no capture-bar HUD
  (dot/timer/Pause/Stop) is present. `frames/hud-hidden-bottom.png` is the
  bottom 90px crop; `frames/hud-hidden-vs-always-bottom.png` is the side-by-side
  proof.

### `recording_hud = always`

Changed through the real Settings UI (Recording HUD → Always; wrote
`"always"` to `~/.config/capture-tool/config.json`).

- Commit **2026-11-04T11:20:57-05:00**; stop **11:21:11-05:00**.
- Full file `/home/inumaki/Videos/Recordings/recording_2026-11-04_11-20-58.mp4`
  (11.7065s). Stable copies: `clips/hud-always-screen.mp4` and
  `clips/hud-always-screen-2s.mp4` (2.000s).
- Frames: `frames/hud-always-0.1.png`, `...1.0.png`, `...1.9.png`.
- `screens/hud-always-mid2.png` (live screen capture at 1.5s) and
  `screens/hud-always-mid1.png` show the S4 HUD at the bottom; the mapped
  layer was `capture 839 1034 243 46` (logical).
- Inspection: the bottom of every clip frame contains the capture-bar S4 HUD
  (`● 00:0N  Pause  ■ Stop`). `frames/hud-always-bottom.png` and the
  side-by-side above.

### Restore

Recording HUD was set back to **Hidden** through the same Settings UI and
verified: `jq '.bar.recording_hud' ~/.config/capture-tool/config.json` →
`"hidden"`. Final config is byte-identical to baseline. **Proven.**

---

## 3. Backend flags are additive (REQ-003:73, design §11.3)

All commands were run from the repo root with the deployed `bin/capture-tool`.

### New commit flags — `screenshot`

Transcript: `backend/screenshot-flags.log`.

```text
$ bin/capture-tool screenshot --target region --geometry '100,100 320x200' --format png --output .../geometry.png
{"output_path": ".../geometry.png", "state": "idle", "target": "region"}   exit=0  (320x200)

$ bin/capture-tool screenshot --target screen --monitor eDP-1 --format png --output .../monitor.png
{"output_path": ".../monitor.png", "state": "idle", "target": "screen"}     exit=0  (1920x1080)

$ bin/capture-tool screenshot --target window --window 0x558b00cbf900 --format png --output .../window.png
{"output_path": ".../window.png", "state": "idle", "target": "window"}      exit=0  (1898x1014 = the kitty client)
```

### Legacy argv (no new flags) still works

```text
$ bin/capture-tool screenshot --target screen --format png --output .../legacy-screen.png
{"output_path": ".../legacy-screen.png", "state": "idle", "target": "screen"}  exit=0  (1920x1080)
```

The legacy interactive region path (`slurp`) was also exercised: the command
below was launched, `slurp` appeared, a 500x400 physical drag was injected,
and the command completed normally:

```text
$ bin/capture-tool screenshot --target region --format png --output .../legacy-slurp-region.png
{"output_path": ".../legacy-slurp-region.png", "state": "idle", "target": "region"}
exit=0; backend/legacy-slurp-region.png = 501x401 (slurp's 1px rounding)
```

### New commit flags — `start` (recording)

Transcript: `backend/start-flags.log`, retry `backend/start-geometry-retry.log`.

```text
$ bin/capture-tool start --target region --geometry '100,100 320x200' --format mp4 --fps 30 --duration 3 --audio none --output .../rec-geometry.mp4
{"backend":"gpu-screen-recorder","state":"recording","target":"region",...}  exit=0
  -> backend/rec-geometry.mp4 = 320x200, 1.233s

$ bin/capture-tool start --target screen --monitor eDP-1 --format mp4 --fps 30 --duration 1 --audio none --output .../rec-monitor.mp4
{"backend":"gpu-screen-recorder","state":"recording","target":"screen",...}  exit=0
  -> backend/rec-monitor.mp4 = 1920x1080, 1.033s

$ bin/capture-tool start --target screen --format mp4 --fps 30 --duration 1 --audio none --output .../rec-legacy-screen.mp4
{"backend":"gpu-screen-recorder","state":"recording","target":"screen",...}  exit=0
  -> backend/rec-legacy-screen.mp4 = 1920x1080, 1.033s
```

The first region `start` attempt at `--duration 1` produced an unreadable
88-byte segment (gpu-screen-recorder had not written a frame before the
auto-stop); the host logged
`segmenting recorder: single segment is unreadable; keeping ...part00.mp4`.
With `--duration 3` the same additive `--geometry` path produced a valid
320x200 clip. This is a recorder-timing limit, not a parsing/flag failure.

Conclusion: legacy argv is byte-identical and still works; the new flags are
additive and route to region/monitor/window without `slurp`. **Proven.**

---

## 4. `scale != 1` geometry (JD Q2=A; REQ-003:73 coordinate-space caution)

Scale was changed with a runtime eval (not written to `monitors.lua`), used for
one region pick, and restored immediately.

Before (`monitors-before.json`, 2026-11-04T11:24:30-05:00):

```text
$ hyprctl monitors -j | jq -r '.[]|[.name,.width,.height,.scale,.x,.y]|@tsv'
eDP-1   1920    1080    1       0       0
```

Set to 1.25 (2026-11-04T11:24:39-05:00):

```sh
hyprctl eval 'hl.monitor({output="eDP-1", mode="1920x1080@144.00", position="0x0", scale=1.25})'
# ok
eDP-1   1920    1080    1.25    0       0     # monitors-scale125.json
```

The overlay was opened and a region was dragged from physical `(350,200)` to
`(1150,750)`. Because the input device is in physical pixels at scale 1.25,
this is logical `(280,160)` → `(920,600)`, i.e. a **640x440** logical pending
rect (the on-screen badge read `640×440 editable`). Screenshot:
`screens/scale125-pending-chrome.png`.

Recording commit **2026-11-04T11:26:24-05:00**. The real argv
(`backend/scale125-rec-ps.txt`) was:

```text
gpu-screen-recorder -w region -region 640x440+280+160 -c mp4 -f 60 ...
  -o /home/inumaki/Videos/Recordings/recording_2026-11-04_11-26-25.mp4
```

The backend received exactly the logical rect the overlay displayed
(`640x440+280+160`), not a mis-scaled copy. The produced video is **800x550**,
i.e. `640x440 × 1.25`, the correct physical size at scale 1.25. Stable clip:
`clips/scale125-region-pick.mp4`.

Content alignment check:

- `screens/scale125-pending-chrome.png` → crop
  `ffmpeg -i screens/scale125-pending-chrome.png -vf crop=800:550:350:200`
  = `frames/scale125-selection-crop.png` (what was selected, with chrome).
- `ffmpeg -ss 1.0 -i clips/scale125-region-pick.mp4 -frames:v 1`
  = `frames/scale125-region-1s.png` (what was recorded).
- The two images show the same text at the same offsets; the recording is not
  shifted. At 1.0s the clip is still the scale-1.25 capture.

Restore (2026-11-04T11:26:43-05:00):

```sh
hyprctl eval 'hl.monitor({output="eDP-1", mode="1920x1080@144.00", position="0x0", scale=1})'
# ok
eDP-1   1920    1080    1       0       0     # monitors-after.json
```

Final check: `hyprctl monitors -j` → `1`, and the display is left unscaled.
**Proven.**

---

## Housekeeping / incidents

- `~/.config/capture-tool/config.json` is byte-identical to the baseline;
  `bar.recording_hud` is `hidden` again.
- `~/.local/state/capture-tool/capture-ui.json` was restored to the observed
  pre-test last-used state (`screenshot region/png`, `recording screen/gif`,
  fps 60, quality high, audio system, duration 0, gif 15, original, cursor
  off).
- **Incident (restored):** a stray click opened the wallpaper-selector window
  and a subsequent action applied `circuit.png` at 11:19 local. It was
  immediately reverted with
  `dotfiles-runtime wallpaper set .../wallpapers/aurora_dragon.png`
  (history: `aurora_dragon.png` was the pre-test wallpaper at 15:40:49Z;
  `circuit.png` at 16:19:00Z; the restore succeeded, `current.json` now names
  `aurora_dragon.png`). The wallpaper-selector app, which was already running
  since 10:22, was restarted afterwards and its window left hidden.
- The 1.25 scale window was ~2 minutes; the display is back at 1.
- The live capture PID remained **511294** throughout.
