---
id: REQ-004
title: "Recording lifecycle — red accent + live HUD (S4)"
kind: requirement
status: done
lane: 3
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-004/
branch: ticket/REQ-004-recording-lifecycle
---

# Recording lifecycle: red accent + live HUD

## Requirement

Recording carries the red-accent convention (design.md D4/D7, FR-7) and ships
the S4 live-recording HUD state (FR-8) honoring the existing
`bar_compact_controls` setting, on top of the REQ-002 bar and REQ-003 pending
protocol.

## Acceptance

- [x] Red accent applies in every recording state (S1/S3 pending, and lane
      chips): active mode chip, **selected** pills, CTA background, and CTA
      label flips `Capture → Record` (frames Sheet 1/3 recording states;
      `--rec-accent` ≈ the palette's red accent, wired through the palette
      refresh, not a hardcoded literal).
      — Source/CSS verified; live visual not measured (Evidence A1–A3).
- [x] S4 chrome visibility follows `bar.recording_hud` (design.md D9/§6,
      default `hidden`): `hidden` = no capture-bar HUD in the frames and
      ags-bar is the sole live timer; launcher/keybind mid-recording presents
      the S4 HUD without altering the capture; `always` = Sheet 3 S4 HUD
      rendered (and therefore recorded); `hover` = bar mapped with chrome
      hidden until pointer entry reveals Pause/Stop. Stop reachable in every
      mode; pure visibility rule covered by tests.
      — Supersedes the earlier "S4 HUD always visible" acceptance; the widget
      tree, timer and locking already verified (Evidence H1–H3) carry over.
      Pure rule, settings tolerance, commit wiring and the launcher/hover paths
      are verified (Evidence H7–H9). The literal "absent from a recorded
      artifact" observation still needs a real clip (Verification limits).
- [x] Live state comes from the event bus (design.md §11.7), not backend
      stdout: `capture.state {state, elapsed_seconds, job_id}` via
      `ags-platform/adapters/event-bus`; Pause/Stop via
      `hub.control(job_id, action)`; ags-bar's existing recording indicator
      coordinated (single indicator or explicit duplication, documented).
      — Bus subscription + `hub.control` verified (Evidence E1–E3). D9 resolves
      the coordination: the default `hidden` makes ags-bar the **sole automatic
      live indicator**; the capture-bar HUD is opt-in (`always`/`hover`) or
      on-demand (launcher mid-recording), and both timers read the same
      `elapsed_seconds` topic (Evidence H7, “Resolved: D9”).
- [x] Red accent uses a palette token (design.md §11.6; start with `@error`
      mapped to `--rec-accent`), no hardcoded hex; if the active theme's
      `@error` is not red-adjacent, stop and report instead of inventing a
      palette source.
      — `@error` is `#ffb4ab` on this host (red-adjacent); CSS has no
      declaration hex (Evidence A1).
- [x] Options locked while live: changing target/format/etc. is impossible
      until `⏹ Stop` returns the bar to S0 (INV-5: S2/S3 overlay machinery is
      fully torn down once live).
      — S4 row contains no option page/pill and `onKey` consumes Esc/Enter
      (Evidence H3).
- [x] `bar_compact_controls` (domain/settings.ts L28–30) semantics are
      honored identically to today: `true` → dot+timer only in the bar and
      Pause/Stop carried by the popup; `false` → bar carries the buttons.
      Both modes covered by TS tests.
      — Pure placement + source wiring tested; live popup click not measured
      (Evidence H3/H4).
- [x] Pause/resume keeps the timer continuous (elapsed time excludes paused
      spans, matching the backend timer semantics — verify against backend
      timekeeping before asserting; stop always terminates backend capture).
      — Backend `_elapsed` excludes paused spans; pause freeze/resume and
      Stop control are executed (Evidence B1, H2).
- [x] Recording live state survives `palette-refresh` in place (INV-4): HUD
      widgets are refreshed, timer value and pause state preserved.
      — Refresh surface still only re-measures; HUD state is not reset
      (Evidence H6).
- [x] Gates: `make test`, `make conformance`, `make backend` (recording HUD
      does not change backend contract apart from REQ-003's commit path);
      `make typecheck`, `make bundle`.
      — All five gates exit 0 at final code HEAD (Evidence G1).

## Evidence

Every command below was run from
`/home/inumaki/Development/dotfiles/ags-capture-tool/.worktrees/REQ-004`.

### A1 — one accent token, mapped to the palette

`style.css:24-32` defines `:root { --rec-accent: @error; }`; the recording
token is never a literal. The generated palette exposes
`@define-color error #ffb4ab` (`ags-bar/colors.css:12`), which is red-adjacent,
so §11.6's stop condition does not apply.
`tests/ts/recording-lifecycle.test.ts:55-65` asserts the mapping and that the
comment-stripped stylesheet contains no hex literal.
**GTK resolution probe (this host, GTK 4.24.1):** a `Gtk.CssProvider` with
`--rec-accent: @error` and `.probe { color: var(--rec-accent); }` renders
`Gdk.RGBA(1.0, 0.706, 0.671)` = `#ffb4ab`, i.e. the custom property really
resolves to the palette token, not to an invalid token stream.

### A2 — recording lane chrome

`style.css:246-266` maps `.bar-cta.record`, the active chip
(`.capture-shell.recording .railicon.active`) and every selected pill
(`.capture-shell.recording .bar-pill.selected`) to `var(--rec-accent)`.
`ui/classic/ClassicWindow.tsx:381-382` sets the shell class from the one
`BarState`, and `:402-407` flips the CTA label `Capture → Record`.
`tests/ts/recording-lifecycle.test.ts:69-94` pins both.

### A3 — pending overlay is red in recording, blue in screenshot

`ui/overlay/SelectionOverlay.tsx:155-163` adds/removes the `recording` class
from the single `OverlayView.mode`; `style.css:102-126` tints rect, handles,
ring, the selected monitor outline and the badge. The dim rule
(`style.css:49-52`) is deliberately untouched and stays neutral.
`tests/ts/recording-lifecycle.test.ts:96-100`.

### H1 — pure S4 state machine, timer and ordering

`domain/recording-hud.ts:113-224`: `formatElapsed`, `elapsedAt` (paused/idle
freeze), `reduceCaptureState` (duplicate/out-of-order/ended-job guards) and
`stoppedHud`. Executed by `tests/ts/recording-hud.test.ts:36-182`:
running → paused → resumed, pause span excluded, duplicate idempotence,
out-of-order ignore, idle/unknown terminal, job replay blocked.

### H2 — the HUD is fed by `capture.state`, not stdout

`ui/classic/ClassicWindow.tsx:636-642` subscribes once per window, hydrates
through the platform client and ticks only the *rendered* value between
pushes (`:645-650`); the source of truth is the pushed `elapsed_seconds`.
Pause/Stop route through `captureState.control`
(`ClassicWindow.tsx:360-373`); Stop closes S0 via `leaveLiveHud`
(`:313-323`). A Stop pressed before the first snapshot stores the intent and
controls the job when its id arrives (`:332-357`).
`tests/ts/recording-lifecycle.test.ts:121-157`.

### H3 — S4 is HUD only; options locked; compact placement

`ui/classic/ClassicWindow.tsx:911-1022` is the S4 row: `hud-dot`, `hud-timer`,
Pause and Stop, plus a popup that only opens in compact mode
(`:926-928`). It contains no back chevron, no option page and no settings
entry. `onKey` consumes Esc/Enter while live (`:533-536`).
`applyHudPlacement` is the single implementation of
`bar_compact_controls` (`:235-240`):
`hudControlPlacement(config.bar_compact_controls)` →
`hudActions.visible = placement.barControls`.
`tests/ts/recording-hud.test.ts:155-158` covers both placements;
`tests/ts/recording-lifecycle.test.ts:102-124,162-167` pins the widget/source
split.

### H4 — commit order and HUD reappearance

`lib/commit-order.ts:25-50` keeps the REQ-003 order and adds the optional HUD
step between the hides and the launch:
`hideOverlay → hideBar → showHud → launch`. Recording passes
`showHud: committingRecording ? enterLiveHud : undefined`
(`ui/classic/ClassicWindow.tsx:514-531`); `enterLiveHud` itself is mode-gated,
so screenshot still leaves the bar hidden and `hidden` never maps it.
Executed by `tests/ts/commit-order.test.ts:71-83`; source-pinned by
`tests/ts/recording-lifecycle.test.ts:169-184`.

### H6 — palette refresh keeps the HUD in place

The registered `AppearanceSurface` still only calls `syncWindowSize`
(`ui/classic/ClassicWindow.tsx:624-628`); it does not touch visibility,
`barState`, `hud` or the timer label. The CSS reload restyles the pulse; the
existing 1s renderer (`:645-650`) repaints the same frozen/running value.
`tests/ts/recording-lifecycle.test.ts:186-190` rejects any reset in the
refresh body.

### H7 — `bar.recording_hud` setting and the pure visibility rule

`domain/settings.ts:29` declares `ConfigRecordingHud = "hidden" | "always" |
"hover"`, `:48` carries it on `bar`, `:69` defaults it to `"hidden"`, `:84-88`
lists the accepted values and `:146-150` merges it with the existing
`configOneOf` tolerance (missing/corrupt/unknown → `hidden`, no throw).
`ui/classic/SettingsPage.tsx:208-221` adds the General-group `Recording HUD`
pill row (Hidden / Always / On hover) and persists through the same
`RowContext` store as Bar position and Top offset.
`domain/recording-hud.ts:57-110` is the pure rule: `hidden` never maps or
shows chrome unless `presentedByLauncher`; `always` maps + shows; `hover` maps
with `showChrome === pointerInside`; not-live is `{false,false}`.
Tests: `tests/ts/domain-settings.test.ts:159-181` (default, round-trip,
corrupt, sibling preservation), `tests/ts/recording-hud.test.ts:185-294`
(hidden/always/hover, the full matrix, stop reachability, corrupt mode).

### H8 — S4 visibility wiring and the launcher presentation path

`ui/classic/ClassicWindow.tsx:242-272` is the only place the rule meets GTK:
opacity hides the row without collapsing the hit area, and mapping is changed
only while live. `enterLiveHud` (`:298-309`) delegates to it, so `hidden` does
not auto-map after commit, `always` maps/presents and `hover` maps with
`pointerInside = false` until entry. The motion controller (`:681-698`) flips
only `pointerInside`; it never calls `captureState.control`, the launcher or
argv. A launcher/keybind map while live in `hidden` sets
`hudPresentedByLauncher` (`:705-714`), and unmapping it clears the flag again
(`:700-704`) so the next bus push cannot re-present it. It reveals Stop/Pause
without touching the job. `leaveLiveHud` (`:313-323`) hides a
launcher-presented `hidden` HUD again on stop.
Tests: `tests/ts/recording-lifecycle.test.ts:196-306` (tolerance, settings
row, pure-rule use, hidden no-auto-show, launcher presentation, hover
controller, hide-on-stop, Stop present in the S4 row).
`tests/ts/commit-order.test.ts` is unchanged and still executes the
`hideOverlay → hideBar → showHud? → launch` order.

### H9 — default hidden coordinates with ags-bar, no double automatic timer

`domain/settings.ts:69` makes `hidden` the default, so a fresh install maps no
capture-bar HUD automatically while recording; ags-bar's existing
`capture.state` widget (`ags-bar/bar/widgets/recording.tsx:51-101`) is the sole
automatic live timer/stop affordance. `always`/`hover` are explicit opt-in
surfaces; both consume the same `elapsed_seconds` topic, so they cannot
disagree about the timer. No ags-bar file was changed.
Executed by `tests/ts/recording-hud.test.ts:185-294` (hidden) and
`tests/ts/domain-settings.test.ts:159-165` (default).

### E1 — the platform event bus is the only reader

`adapters/platform-capture-state-feed.ts:11-17` imports
`domainEvents` from `ags-platform/adapters/event-bus` and binds it through
`lib/capture-state-feed.ts:24-38`. No app-local event client exists
(`tests/ts/platform-consumption.test.ts` check 4).
`tests/ts/capture-state-feed.test.ts:53-127` executes subscribe, unsubscribe,
`Control(job_id, action)`, empty-job refusal and restart forwarding against a
mocked hub; the adapter's import is source-pinned at `:122-127`.

### E2 — event-bus contract shape

`dotfiles-runtime/contracts/event-contract.md:108` defines
`capture.state {state, elapsed_seconds}`; the additive `job_id` is documented
in `dotfiles-runtime/src/runtime/application/capture.py:249-256`.

### B1 — backend timer semantics (paused spans excluded)

`dotfiles-runtime/src/runtime/application/capture.py:238-247`: `_elapsed`
adds only the current recording segment; `pause` accumulates and clears the
segment, so paused time is never counted. This is the semantic the HUD's
freeze/resume test models (`tests/ts/recording-hud.test.ts:63-84`).

### G1 — gates (final code HEAD `d3cd929`)

| Gate | Exit | Key output |
|---|---|---|
| `make test` | 0 | `tests 297 / pass 297`, tests `tsc` clean |
| `make conformance` | 0 | `tests 16 / pass 16` |
| `make backend` | 0 | `114 passed` |
| `make typecheck` | 0 | `OK: 0 errors in the ags-capture-tool tree` |
| `make bundle` | 0 | `build/capture.js (1450880 bytes)` |

Per-commit gates were also run on `30b12a8` (commit 1) and `3c9c09d`
(commit 2) with the same five commands, all exit 0. The D9 code/test commit
`d3cd929` was gated with all five commands immediately before the ticket-only
commit that follows it; the same five gates were re-run after that ticket-only
commit with identical results.

## Verification limits

- No interactive compositor session in this harness: the pulsing animation,
  live pointer clicks on the compact popup, and actual layer-surface stacking
  were **not measured**. The widgets and state are source- and unit-pinned.
- No hub was running during implementation, so the real
  `Control(job_id, action)` round trip and the live `capture.state` cadence
  were **not exercised end-to-end**; the binding is tested against a mocked
  hub and the contract is cited.
- The "is the HUD in the file?" observation was reasoning from
  compositor/layer semantics at implementation time. T2 has now produced the
  real clips: `hidden` → no capture-bar HUD in the clip; `always` → the S4 HUD
  is in the clip. Evidence: `/tmp/opencode/capture-t2/EVIDENCE.md` §2 and the
  checked follow-up below.

## Resolved: D9 (2026-10-30) — HUD modes and the ags-bar indicator

**Decision.** S4 visibility is settings-driven through `bar.recording_hud`
(design.md D9/§6): `hidden` (default) / `always` / `hover`. The earlier
"always visible / user decision required" position is superseded.

- **`hidden` (default):** the bar is not presented automatically while live;
  ags-bar is the sole automatic live timer and stop affordance, so recordings
  carry no capture-bar chrome. A launcher/keybind invocation mid-recording
  presents the S4 HUD (Stop/Pause reachable) without altering the capture, and
  Stop hides it again. Evidence H7–H9.
- **`always`:** the Sheet 3 S4 HUD is mapped/presented automatically after
  commit and is therefore part of recorded frames (the previous behaviour,
  now opt-in). Evidence H7/H8.
- **`hover`:** the bar window stays mapped as a hit area with chrome at
  opacity 0; pointer entry reveals Pause/Stop, pointer leave hides the chrome.
  Evidence H7/H8.

`Stop` remains reachable in all three modes (always visible, hover on pointer
entry, hidden through the launcher), and the matrix is executed in
`tests/ts/recording-hud.test.ts:251-284`.

**Coordination with ags-bar.** No ags-bar change was made. Because the default
is `hidden`, there is exactly one automatic live indicator (ags-bar); the
capture-bar HUD is opt-in or on-demand. When it is shown, both surfaces consume
the same `capture.state` `elapsed_seconds` topic, so they cannot disagree about
the timer. This is the "single indicator or explicit duplication, documented"
resolution the bus acceptance asked for (Evidence E1–E3, H9).

### Follow-up (hardware verification — closed by T2, 2026-11-04)

- [x] Recorded-clip proof: with the default `hidden`, a full-screen recording
      contains no capture-bar HUD; with `always` it does. Requires a real
      compositor session and a produced clip, neither available in this
      harness.
      — T2 recorded both on the live compositor on 2026-11-04. `hidden`
      (2026-11-04T11:17:11-05:00 commit → 11:17:14 stop):
      `/tmp/opencode/capture-t2/clips/hud-hidden-screen-2s.mp4` (full
      28.15s source `hud-hidden-screen.mp4`) — no `capture` layer after commit
      and no capture-bar HUD in `frames/hud-hidden-*.png`; only the ags-bar
      top indicator is present. `always` (after the real Settings UI wrote
      `"always"`; commit 11:20:57 → stop 11:21:11):
      `clips/hud-always-screen-2s.mp4` (full 11.71s `hud-always-screen.mp4`) —
      the bottom S4 HUD is visible in `frames/hud-always-*.png` and in
      `screens/hud-always-mid2.png`. See
      `frames/hud-hidden-vs-always-bottom.png` for the side-by-side crop.
      `bar.recording_hud` was restored to `hidden` and verified. Commands /
      timestamps: `/tmp/opencode/capture-t2/EVIDENCE.md` §2.

## Design notes / deviations

- S4's ⚙ is “allowed” in design.md §5 but omitted: settings is S0-only (INV-3)
  and the ticket locks every option while live. This is stricter than the
  mockup, not a contradiction.
- The HUD shows `Resume` while paused (ags-bar does the same); the mockup's S4
  frame only draws the running state.
- The red token is `@error` exactly as §11.6 instructs; no second palette
  source was invented.
