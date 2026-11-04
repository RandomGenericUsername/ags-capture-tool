---
id: REQ-003
title: "Selection-first capture flow — pending protocol + irreversible commit"
kind: requirement
status: done
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Selection-first capture flow

> **Closed 2026-11-04 (T3):** all acceptance boxes are ticked. T2 verification
> evidence lives in `/tmp/opencode/capture-t2/EVIDENCE.md` and the repo record
> [OPS-002](../OPS-002-verification-proof/evidence.md). The implementation
> branch `ticket/REQ-003-selection-first-flow` is merged into `main`; the
> worktree directory is left for T5 cleanup.

## Requirement

Replace "complete selection = capture" with the pending-selection protocol of
design.md §4 (FR-4/5/6/10): opening a mode engages its selection affordance
immediately; selections stay live and editable until shutter/Enter commits;
commit is a one-way door; the AGS overlay owns selection geometry and hands
the backend a finished commit.

## Acceptance

- [x] **Region:** on entering Screenshot (or Recording) with Region target,
      the desktop dims and a drawn rectangle **persists** after mouse
      release; drag-inside moves it, any of its 8 handles resizes it, drag on
      the dim = starts a fresh rect (frames Sheet 2 §Region; handles match
      `.selrect/.hx` mock geometry). Release never captures.
      — Live pointer interaction not measured in this headless session; the
      geometry/drag math and “release never launches” are executed/source-pinned
      (Evidence R1–R3).
- [x] **Window:** highlight ring follows the pointer across clients with a
      badge (title + size); a click **pins** the client; clicking another
      client re-pins; Esc unpins (then next Esc unmodes). Hover alone never
      captures; pin never captures (frames Sheet 2 §Window).
      — Logic executed with fake Astal client rects; live pointer not measured
      (Evidence W1–W3).
- [x] **Screen:** monitor outline is the pending pick; single monitor shows a
      confirmation frame; with >1 monitors a `Monitor n` chip in the bar
      swaps the pick, clicking another screen's outline also swaps
      (frames Sheet 2 §Screen).
      — Outline/chip source-pinned; swap/reset executed in the controller;
      live multi-monitor click not measured (Evidence S1–S3).
- [x] **Commit:** `Shutter`/`Record` button or `Enter` takes the capture with
      the exact on-screen selection; releasing a drag does not fire (old
      behavior regression-tested as forbidden).
      — `Capture`/`Record` label conflict noted below; argv is exact and the
      overlay has no launcher/screenshotArgs reference (Evidence C1–C3).
- [x] **One-way door (D6):** after commit, no state can alter the captured
      region/selection: in recording → only S4 HUD exists; in screenshot →
      selection chrome is destroyed at commit. Design-level proof: the state
      machine (design.md §3) contains no post-commit editing transition;
      test asserts the transition table rejects it.
      — S4 HUD itself is REQ-004; this ticket proves the selection session locks
      and clears (Evidence D1–D2).
- [x] **Overlay never captured (FR-10):** the dim + selection chrome are
      hidden synchronously with the commit and before the backend captures /
      recording starts. Verify: unit test ordering hide→launch; manual grep
      of commit path for no async gap; a recorded 2s clip contains no
      selection UI (manual evidence in ticket).
      — Automated ordering + source grep are green (Evidence F1–F3). T2
      recorded the real Region + MP4 commit on 2026-11-04. Pending chrome was
      visible before commit (`/tmp/opencode/capture-t2/screens/pending-selection-chrome.png`);
      an independent wf-recorder control clip shows that same chrome
      (`/tmp/opencode/capture-t2/clips/pending-chrome-external.mp4`); the app's
      own clip has no dim/outline/handles in any sampled frame from **0.05s**
      through 7s (`clips/pending-selection-app-region.mp4`, 2s copy
      `pending-selection-app-region-2s.mp4`, frames `pending-app-*.png`).
      Commands/timestamps: `EVIDENCE.md` §1.
- [x] **Overlay surface (design.md §11.2):** selection chrome lives in a
      separate per-monitor `capture-overlay` window (layer TOP,
      exclusivity IGNORE, keymode NONE) — never named `capture-window`; the
      bar stays OVERLAY/ON_DEMAND and retains Enter/Esc; overlay present in
      S1–S3 only, absent S0/S4; unregistered on destroy (no dead-widget
      refresh).
      — S4 is REQ-004; absence outside an open session is pinned (Evidence O1–O3).
- [x] **Backend commit flags only additive (design.md §11.3):** legacy argv
      arrays stay byte-identical and the legacy slurp path still works for
      CLI users; the UI path builds `--geometry "X,Y WxH"` / `--monitor` /
      `--window 0x…` and never triggers `slurp` (test: monkeypatched
      `resolve_target` must not be called; vanished window → typed error,
      no slurp fallback). Coordinate-space caution verified: rect correctness
      on one `scale≠1` output and negative monitor origins (§11.2).
      — B1–B6 remain green, and T2 exercised the deployed backend on
      2026-11-04: legacy `screenshot --target screen` and the interactive
      `slurp` region path both succeeded; the additive
      `--geometry`/`--monitor`/`--window` screenshot flags produced
      320x200 / 1920x1080 / 1898x1014 images; `start` produced clips for
      `--geometry` (320x200), `--monitor` (1920x1080) and legacy screen
      (1920x1080). The `scale≠1` check was then measured: with `eDP-1` at
      scale **1.25**, a logical 640x440 pending pick was passed as
      `-region 640x440+280+160` and the resulting clip was 800x550 (×1.25),
      content-aligned with the selection; scale was restored to 1.0.
      Transcripts/shots: `EVIDENCE.md` §3–§4; `backend/*.log`,
      `monitors-{before,scale125,after}.json`,
      `clips/scale125-region-pick.mp4`.
- [x] **Backend contract pivot (D8/§8.1):** commit passes finished geometry
      (region/screen) or a window reference (window) to `bin/capture-tool`;
      domain/argv updated and pure; `domain/`, `ports/` stay GTK-free;
      backend pytest covers the new commit path (`make backend` green).
- [x] **Region confined to one monitor** by construction: geometry clamped to
      the hosting overlay's monitor bounds (§4 rule 4).
- [x] Esc unwind = one level per press per design.md §4.7: (a) clear the
      pending pick (window unpin / monitor chip back to focused / region rect
      cleared to an empty overlay), mode stays open; (b) close the mode and
      hide the overlay; (c) hide the bar from S0. Enter never participates;
      pinning survives `palette-refresh` (INV-4).
- [x] Gates: `make test`, `make conformance`, `make backend`,
      `make typecheck`, `make bundle`.

## Evidence

Every command below was run from
`/home/inumaki/Development/dotfiles/ags-capture-tool/.worktrees/REQ-003`.

### R1 — region rect is a persistent pending object

`domain/selection-session.ts:32-59,62-70,102-123` — `beginSelection("region")`
starts with `rect: null`; `setRegionRect()` stores the pending rect;
`selectionOf()` returns it only when a rect exists.

### R2 — draw/move/resize/clamp math (negative origins included)

`domain/selection.ts:90-170` — `rectFromPoints`, `moveRect`, `resizeRect`
(8 named handles), `clampRect` (whole rect fits, 1px minimum).
Executed by `tests/ts/selection.test.ts:68-142` (clamp with a `-1920` monitor
origin, move to edges, resize never inverted, 9px handle positions match `.hx`).

### R3 — release never captures; `.selrect/.hx` chrome

`ui/overlay/SelectionOverlay.tsx:287-341` wires pointer press/motion/release;
the release path calls only `controller.setRect`/`pinAt`/`selectMonitor`.
`tests/ts/overlay-contract.test.ts:119-124` asserts the overlay source has no
`launcher|runCommit|screenshotArgs|recordingArgs`.
`style.css:56-99` defines `.selrect`, `.selhandle`+`.hx` (9px), `.selring`,
`.mon-outline`, `.selbadge` from palette tokens only.

### W1 — hover/pin/re-pin/unpin

`ui/overlay/controller.ts:227-249` reads a FRESH client list on every hover and
pin; `domain/selection.ts:232-247` hit-tests global points.
Executed by `tests/ts/selection-controller.test.ts:104-158` (hover never pins,
click pins, another click re-pins, empty click keeps the pin, Esc unpins).
Adapter: `adapters/hyprland-window-clients.ts:64-87` maps
`address/title/class/x/y/width/height/monitor`.

### W2 — badge title + size

`domain/selection.ts:321-326` (`windowBadge`) and
`ui/overlay/SelectionOverlay.tsx:176-191`; executed by
`tests/ts/selection.test.ts:189-202`.

### W3 — commit reference

`domain/cli-args.ts:66-74` emits `--window <address>`; backend resolves it at
commit: `bin/capture-tool:246-264`, never slurp.

### S1 — monitor outline + focused default

`ui/overlay/SelectionOverlay.tsx:180-214` draws/selects the outline;
`domain/selection-session.ts:102-123` defaults screen to the focused monitor.
`tests/ts/selection-controller.test.ts:160-170` exercises the pick/reset.

### S2 — `Monitor n` chip only when >1

`ui/classic/ClassicWindow.tsx:163-181,570-586`; hidden for `count <= 1`.
Source-pinned by `tests/ts/overlay-contract.test.ts:109-117`.

### S3 — coordinate translation

`domain/selection.ts:281-296` (`localToGlobal`/`globalToLocal`);
`tests/ts/selection.test.ts:204-220` asserts negative origins exactly.
T2 measured one scaled output with a positive origin (`eDP-1`, scale 1.25);
a scaled output with a negative monitor origin remains unit-tested only (see
Verification limits).

### C1 — exact argv per selection kind

`domain/cli-args.ts:66-74,84-99,116-139`.
`tests/ts/selection-args.test.ts:48-146` asserts exact arrays, canonical
`X,Y WxH`, append-at-END, and no new flag when no selection exists.

### C2 — hide → launch call order (FR-10)

`lib/commit-order.ts:23-42`; `ui/classic/ClassicWindow.tsx:275-318` builds the
request, then `runCommit({hideOverlay, hideBar, launch})`.
`tests/ts/commit-order.test.ts:14-67` executes the order, the synchronous
observation, and the thrown-launch path.

### C3 — button/Enter both commit

CTA `onClicked={commitCurrentMode}` and Enter → `enterAction` →
`commitCurrentMode` at `ui/classic/ClassicWindow.tsx:340-350,590`; the CTA is
disabled until `selection.canCommit()` (`ClassicWindow.tsx:173-174`).
Label currently reads `Capture` (design §5) while Sheet 2/ticket prose says
`Shutter` — reported as a spec contradiction, not silently renamed.

### D1 — commit locks the session

`domain/selection-session.ts:172-180` returns `emptySelection(...)` (inactive)
after snapshotting; every setter refuses an inactive session
(`selection-session.ts:62-94`). Executed by
`tests/ts/selection-session.test.ts:89-114`.

### D2 — no post-commit editing transition

`tests/ts/selection-session.test.ts:100-114` asserts retarget/setRect/pin/
setMonitor all return the same inactive session and `clearPending` closes.

### F1 — overlay hides synchronously at commit

`ui/overlay/controller.ts:269-276` (`commit`) sets the session inactive and
re-renders, which sets every `overlayWindow.visible = false`;
`tests/ts/selection-controller.test.ts:172-186` asserts the host's last
visibility is `false`. FR-10 ordering test in C2.

### F2 — no async gap in the commit path

`ui/classic/ClassicWindow.tsx:304-318`: `hideOverlay`, `hideBar`, `launch` are
called in one synchronous block. The only delay is the launcher adapter's
existing 150ms compositor wait, which runs AFTER the hides
(`adapters/exec-capture-launcher.ts:23-28`).

### F3 — manual recorded clip

**NOT VERIFIED.** No 2s recording was taken in this session (no interactive
compositor session in the harness). The code path is ordering-tested, but the
manual artifact the checklist asks for does not exist.

### O1 — overlay identity/layer contract

`ui/overlay/SelectionOverlay.tsx:50,374-388`:
`name="capture-overlay"`, `layer=TOP`, `exclusivity=IGNORE`, `keymode=NONE`,
all four anchors, zero margins, `gdkmonitor={gdkmonitor}`.
`tests/ts/overlay-contract.test.ts:36-60` pins it and the bar's unchanged
`capture-window`/OVERLAY/ON_DEMAND.

### O2 — presence and lifecycle

`ui/overlay/controller.ts:141-159` hides every host when `session.active` is
false; region only on the focused monitor, window/screen on all.
`ui/overlay/SelectionOverlay.tsx:406-420` registers appearance + controller
and unregisters on `destroy`. `adapters/overlay-window-set.ts:45-80` removes
then destroys removed-monitor overlays.

### O3 — CSS-only chrome (no Cairo)

`ui/overlay/SelectionOverlay.tsx:62-68,333-368` builds `Gtk.Box`/`Gtk.Label`/
`Gtk.Fixed` chrome; `tests/ts/overlay-contract.test.ts:62-73` rejects
DrawingArea/Cairo and pins the palette-token CSS.

### B1 — additive parse/defaults

`bin/capture-tool:1484-1519` adds `--geometry`, `--monitor`, `--window` to both
subcommands. `tests/python/test_capture_commit_path.py:96-126` asserts defaults
are `None` and help lists them.

### B2 — geometry skips slurp, canonical form

`bin/capture-tool:215-257,340-418`; executed by
`tests/python/test_capture_commit_path.py:130-165` with
`resolve_target` monkeypatched to raise.

### B3 — window resolve + vanished typed error

`bin/capture-tool:246-264`; `tests/python/test_capture_commit_path.py:168-194`
(case-insensitive address resolve, `-g`, empty clients → `WindowNotFoundError`,
`error_kind="window_not_found"`).

### B4 — `grim -o` per monitor, legacy all-outputs

`bin/capture-tool:394-410`; `tests/python/test_capture_commit_path.py:196-227`.

### B5 — recording paths

`bin/capture-tool:441-470,538-590`; `tests/python/test_capture_commit_path.py:261-338`
(region `-region WxH+X+Y`, window resolved geometry, gsr `-w monitor`,
wf-recorder `-o monitor`, legacy focused-monitor path).

### B6 — legacy argv unchanged

`tests/ts/domain-cli-args.test.ts` (existing exact arrays) + new
`tests/ts/selection-args.test.ts:140-146`; Python
`tests/python/test_capture_commit_path.py:209-231,318-328`.

### P1 — pure layers

`domain/selection.ts`, `domain/selection-session.ts`, `domain/cli-args.ts`,
`ports/window-clients.ts`, `lib/commit-order.ts` import no `ags/*` or
`gi://*`; `make typecheck` passes. `tests/ts/overlay-contract.test.ts:83-90`
asserts the controller has no runtime platform import.

### G1 — gates (final code HEAD `30ce1db`)

| Gate | Exit | Key line |
|---|---|---|
| `make test` | 0 | `tests 10 / pass 10`, `tests 244 / pass 244`, tests `tsc` clean |
| `make conformance` | 0 | `tests 16 / pass 16` |
| `make backend` | 0 | `114 passed` |
| `make typecheck` | 0 | `OK: 0 errors in the ags-capture-tool tree` |
| `make bundle` | 0 | `build/capture.js (1281044 bytes)` |

## Verification limits

- No interactive compositor session was used: live pointer drag/hover, actual
  overlay stacking over `ags-bar`, and keyboard focus after mapping are
  **not measured** here.
- The `scale≠1` coordinate check that was originally unmeasured is now closed
  for a **positive-origin** output by T2: `eDP-1` was temporarily set to scale
  1.25, one region pick produced `-region 640x440+280+160` → an 800x550 clip,
  and the display was restored to scale 1.0. Evidence:
  `/tmp/opencode/capture-t2/EVIDENCE.md` §4. A scaled output with a **negative
  monitor origin** was not measured on hardware and remains unit-tested only
  (`tests/ts/selection.test.ts:204-220`); do not claim otherwise.
- The manual 2-second FR-10 recording artifact is now produced and linked in
  the "Overlay never captured" item above. Evidence:
  [`OPS-002 evidence`](../OPS-002-verification-proof/evidence.md) §1 /
  `/tmp/opencode/capture-t2/EVIDENCE.md` §1.

## Spec contradiction

design.md §5 draws the screenshot CTA as `Capture`; §3/§4, Sheet 2/3 and this
ticket's acceptance prose say `Shutter`. The bar keeps the normative §5 label
`Capture` rather than inventing a third term. Resolve before the visual review.
