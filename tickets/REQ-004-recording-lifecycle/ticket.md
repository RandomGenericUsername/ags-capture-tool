---
id: REQ-004
title: "Recording lifecycle — red accent + live HUD (S4)"
kind: requirement
status: in-progress
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
- [x] S4 HUD while recording is live: pulsing red dot, elapsed `MM:SS` timer,
      Pause/Stop buttons; **no target/fps/quality/audio pills**, no `←`
      (INV-2 excludes S4; frame Sheet 3 `S4`).
      — Widget tree + pure state executed/source-pinned; live compositor
      rendering not measured (Evidence H1–H3).
- [ ] Live state comes from the event bus (design.md §11.7), not backend
      stdout: `capture.state {state, elapsed_seconds, job_id}` via
      `ags-platform/adapters/event-bus`; Pause/Stop via
      `hub.control(job_id, action)`; ags-bar's existing recording indicator
      coordinated (single indicator or explicit duplication, documented).
      — Bus subscription + `hub.control` are verified (Evidence E1–E3). NOT
      TICKED: the coordination decision is a **user decision** (see “User
      decision required”); the HUD is a layer surface expected to be captured
      and the indicator is explicitly duplicated with ags-bar.
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
      `make typecheck`.
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
`ui/classic/ClassicWindow.tsx:337-340` sets the shell class from the one
`BarState`, and `:359-363` flips the CTA label `Capture → Record`.
`tests/ts/recording-lifecycle.test.ts:66-91` pins both.

### A3 — pending overlay is red in recording, blue in screenshot

`ui/overlay/SelectionOverlay.tsx:155-163` adds/removes the `recording` class
from the single `OverlayView.mode`; `style.css:102-126` tints rect, handles,
ring, the selected monitor outline and the badge. The dim rule
(`style.css:49-52`) is deliberately untouched and stays neutral.
`tests/ts/recording-lifecycle.test.ts:93-97`.

### H1 — pure S4 state machine, timer and ordering

`domain/recording-hud.ts:24-176`: `formatElapsed`, `elapsedAt` (paused/idle
freeze), `reduceCaptureState` (duplicate/out-of-order/ended-job guards) and
`stoppedHud`. Executed by `tests/ts/recording-hud.test.ts:36-174`:
running → paused → resumed, pause span excluded, duplicate idempotence,
out-of-order ignore, idle/unknown terminal, job replay blocked.

### H2 — the HUD is fed by `capture.state`, not stdout

`ui/classic/ClassicWindow.tsx:585-602` subscribes once per window, hydrates
through the platform client and ticks only the *rendered* value between
pushes; the source of truth is the pushed `elapsed_seconds`. Pause/Stop route
through `captureState.control` (`ClassicWindow.tsx:313-328`); Stop closes S0
via `leaveLiveHud` (`:273-279`). A Stop pressed before the first snapshot
stores the intent and controls the job when its id arrives (`:287-311`).
`tests/ts/recording-lifecycle.test.ts:118-150`.

### H3 — S4 is HUD only; options locked; compact placement

`ui/classic/ClassicWindow.tsx:826-939` is the S4 row: `hud-dot`, `hud-timer`,
Pause and Stop, plus a popup that only opens in compact mode
(`:840-845`). It contains no back chevron, no option page and no settings
entry. `onKey` consumes Esc/Enter while live (`:485-488`).
`applyHudPlacement` is the single implementation of
`bar_compact_controls` (`:229-234`):
`hudControlPlacement(config.bar_compact_controls)` →
`hudActions.visible = placement.barControls`.
`tests/ts/recording-hud.test.ts:155-158` covers both placements;
`tests/ts/recording-lifecycle.test.ts:99-116,159-165` pins the widget/source
split.

### H4 — commit order and HUD reappearance

`lib/commit-order.ts:25-50` keeps the REQ-003 order and adds the optional HUD
step between the hides and the launch:
`hideOverlay → hideBar → showHud → launch`. Recording passes
`showHud: committingRecording ? enterLiveHud : undefined`
(`ui/classic/ClassicWindow.tsx:462-482`); screenshot still leaves the bar
hidden. Executed by `tests/ts/commit-order.test.ts:69-82`; source-pinned by
`tests/ts/recording-lifecycle.test.ts:166-181`.

### H6 — palette refresh keeps the HUD in place

The registered `AppearanceSurface` still only calls `syncWindowSize`
(`ui/classic/ClassicWindow.tsx:576-580`); it does not touch visibility,
`barState`, `hud` or the timer label. The CSS reload restyles the pulse; the
existing 1s renderer (`:597-602`) repaints the same frozen/running value.
`tests/ts/recording-lifecycle.test.ts:183-187` rejects any reset in the
refresh body.

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

### G1 — gates (final code HEAD `91cd10c`)

| Gate | Exit | Key output |
|---|---|---|
| `make test` | 0 | `tests 282 / pass 282`, tests `tsc` clean |
| `make conformance` | 0 | `tests 16 / pass 16` |
| `make backend` | 0 | `114 passed` |
| `make typecheck` | 0 | `OK: 0 errors in the ags-capture-tool tree` |
| `make bundle` | 0 | `build/capture.js (1430744 bytes)` |

Per-commit gates were also run on `30b12a8` (commit 1) and `3c9c09d`
(commit 2) with the same five commands, all exit 0.

## Verification limits

- No interactive compositor session in this harness: the pulsing animation,
  live pointer clicks on the compact popup, and actual layer-surface stacking
  were **not measured**. The widgets and state are source- and unit-pinned.
- No hub was running during implementation, so the real
  `Control(job_id, action)` round trip and the live `capture.state` cadence
  were **not exercised end-to-end**; the binding is tested against a mocked
  hub and the contract is cited.
- No recording was produced, so the "is the HUD in the file?" observation is
  reasoning from compositor/layer semantics, not an artifact (see below).

## User decision required — HUD capture and the ags-bar indicator

**1. Is the capture-bar HUD captured?** The HUD lives in `capture-window`, a
layer-shell surface (`ui/classic/ClassicWindow.tsx:556-568`:
`layer=OVERLAY`, `exclusivity=IGNORE`, never EXCLUSIVE). The recorder backends
are `gpu-screen-recorder` / `wf-recorder` (`bin/capture-tool:165-200`), which
capture the composited output. A composited layer surface is therefore
**expected to be baked into every recorded frame** that intersects it — for a
full-screen recording, every frame. This was not measured with a real clip.

**2. How it is coordinated with ags-bar.** The design allows “single indicator
or explicit duplication”. This ticket implements **explicit duplication**:
ags-bar's existing widget (`ags-bar/bar/widgets/recording.tsx:51-101`) and the
new capture-bar HUD both subscribe to the same `capture.state` topic and use
the same `elapsed_seconds` semantics, so they cannot disagree about the timer
(both interpolate locally between pushes). Two indicators are still visible at
once while recording. A single indicator would require changing ags-bar or the
runtime (outside this repo / AD-1), or hiding the S4 HUD (contradicts design
§3/§5).

Because the HUD would be part of the recording, the “live state / coordination”
acceptance item stays unticked pending a user decision:
- accept the HUD in every frame, or
- exclude/hide it (requires a design change and probably a recorder-side
  exclusion mechanism), and
- confirm explicit duplication with ags-bar is acceptable, or schedule the
  single-indicator follow-up.

## Design notes / deviations

- S4's ⚙ is “allowed” in design.md §5 but omitted: settings is S0-only (INV-3)
  and the ticket locks every option while live. This is stricter than the
  mockup, not a contradiction.
- The HUD shows `Resume` while paused (ags-bar does the same); the mockup's S4
  frame only draws the running state.
- The red token is `@error` exactly as §11.6 instructs; no second palette
  source was invented.
