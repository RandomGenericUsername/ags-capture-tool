# design.md — Capture bar redesign (normative)

Status: **normative for EPIC-001.** The implementing agent implements *this*
document. Every frame mentioned here is drawn in
[mockups/capture-bar-mockups.html](./mockups/capture-bar-mockups.html):

- **Sheet 1** — density presets A/B/C with screenshot *and* recording states.
  **Decision: C + back is normative** (see decision log). A and B are recorded
  as rejected alternatives, kept only as historical context.
- **Sheet 2** — pending-selection frames per target (region / window / screen).
- **Sheet 3** — the normative state board S0–S4 plus top-placement variant.

Claims about the current app carry evidence from the repo; see §9.

---

## 1. Scope and non-goals

**In scope** — replace the centred three-page panel
(`ui/classic/ClassicWindow.tsx`, `RecordingPage.tsx`, `ScreenshotPage.tsx`,
`SettingsPage.tsx`) with a minimalist capture bar, keep all existing
functionality 1:1, and change the capture flow to selection-first.

**Non-goals (explicit — do not build to fight scope creep):**

- No annotation/editor phase (the Shutter-style post-capture editor discussed
  in the session is **parked**, not scheduled).
- No region-alteration capability **after commit** in any state.
- No cross-monitor regions.
- No structural window teardown/rebuild (per AGENTS.md §5 residual, the
  refresh stays in-place).

---

## 2. Decision log (each binds; the agent does not re-litigate)

| # | Date | Decision | Authority |
|---|------|----------|-----------|
| D1 | 2026-10-30 | Density preset **C (icon-only until touch) + explicit back button** | JD, session 2026-10-30 |
| D2 | 2026-10-30 | Bar shows on the **focused monitor only** | JD |
| D3 | 2026-10-30 | Top placement: **auto-detect other top layer surfaces + manual pixel offset in settings**. Bottom is the default-recommended position | JD |
| D4 | 2026-10-30 | **Red accent for recording** (active chip, selected pills, CTA, CTA label `Capture → Record`); screenshot keeps the blue palette accent | JD (via mock review) |
| D5 | 2026-10-30 | **Selection-first flow**: selection becomes a persistent, editable pending object; shutter commits (replaces "complete selection = fire") | JD |
| D6 | 2026-10-30 | **Commit is a one-way door**: selection locks irreversibly at shutter; no post-commit editing state exists | JD (normative correction) |
| D7 | 2026-10-30 | Same pending protocol applies to **recording**, red-tinted (S3); commit ordering: overlay must vanish before first recorded frame | JD ("region/window hold up applies for recorder") |
| D8 | 2026-10-30 | Region transfer passes **geometry**; window pick passes a window **reference** (backend resolves geometry at commit) | Sally, confirmed JD |
| D9 | 2026-10-30 | S4 HUD visibility is settings-driven `recording_hud` = `hidden` \| `always` \| `hover`, **default `hidden`** (videos clean; ags-bar is the sole live timer). `always` ships the Sheet 3 HUD in recordings; `hover` shows it only while the pointer is over the bar | JD (explicit) |

---

## 3. State machine

The bar is a small state machine. States are named S0–S4 and are the
vocabulary for every acceptance criterion.

| State | Name | Visual (frame ref) | Exit paths |
|---|---|---|---|
| S0 | Rest / home | Three icons: screenshot · recording · settings (~120px). Bottom-anchored by default | Tap 📷 → S1(screenshot); tap 🎥 → S1(recording); tap ⚙ → settings surface |
| S1 | Mode open | `←` chevron leads, mode icon active, target pills inline (+ delay/format/output for screenshot; fps/quality/audio for recording), CTA at the end | `←` or Esc → S0; tap *other* mode icon → S1(other mode); for recording: `Record` → S4; for screenshot: `Shutter` → commit |
| S2 | Pending selection | Overlay over desktop: dim + the mode's selection affordance (see §4). Reached **automatically on entering S1** | Shutter/Enter → commit (irreversible); Esc → unpin (S2) → unmode (S1) → home (S0), one level per press |
| S3 | Recording open + pending | Same overlay grammar as S2, **red-tinted**; Record commits | `Record`/Enter → overlay drops → capture starts (S4) |
| S4 | Recording live | HUD only: pulse dot + elapsed timer + Pause/Stop; **no `←`**, no options | `⏹ Stop` → S0 (pause/resume per `bar_compact_controls`, §6) |

**Transitions and events (normative):**

```
S0 --tap 📷--> S1(scr) --> S2 pending --Shutter/Enter--> COMMIT
S0 --tap 🎥--> S1(rec) --> S3 pending --Record/Enter--> overlay-drop --> S4 (live) --⏹--> S0
any opened state --←/Esc--> back one level (unpin → unmode → home)
S1(scr) --tap 🎥--> S1(rec)   (lane switch without going home; and vice versa)
```

Invariants:

- INV-1 — the CTA (`Shutter` / `Record`) is present in **every** open state at
  the same end-of-row position; `Enter` is its keyboard twin. [frame S1–S3]
- INV-2 — `←` exists in every opened state **except S4**.
- INV-3 — settings ⚙ is reachable from **S0 only**.
- INV-4 — an incoming `palette-refresh` must not kick the bar out of its
  current state; state and pending selection survive [AGENTS.md §5].
- INV-5 — while a recording is S4-live, the S2/S3 overlay machinery is fully
  torn down; S4 shows only the HUD package.

---

## 4. Pending-selection protocol (mode- and target-independent)

Opening a capture mode **immediately engages** that mode's selection
affordance; a completed selection gesture is **pending**, never committing.

| Target | Affordance | Interactions before commit | Badge |
|---|---|---|---|
| Region | Dimmed desktop + rectangle with 8 handle squares [Sheet 2 §Region] | drag inside = move; grab a handle = resize; drag outside-dim = start a fresh rect | live `W×H · editable` |
| Window | highlight ring follows pointer across clients [Sheet 2 §Window] | click = pin; click another client = re-pin; Esc = unpin | client title + size |
| Screen | monitor outline highlight [Sheet 2 §Screen]; multi-monitor: `Monitor n` chip in the bar swaps the pick | click another screen's outline also swaps pick | monitor id + resolution |

Protocol rules:

1. Selection lives **while the bar is open** (S1↔S2 coexist; the bar is the
   HUD carrying commit [Sheet 2 captions]).
2. Committed geometry is whatever is on screen at shutter time — final,
   exact, no time travel.
3. **The overlay (dim + rings/rect + badge) is never part of a shipped
   capture.** For recording this is a hard ordering requirement: overlay and
   dim must drop synchronously with `Record`, before the backend's first
   frame lands (see FR-10).
4. Region is confined to **one monitor** by construction (geometry clamped;
   per-monitor overlay windows stay the deployment unit [README L21–23]).
5. Region hands over **geometry**; window hands over a **reference** resolved
   by the backend at commit time (D8).
6. **Overlay surface contract (§11.2, resolved):** the selection overlay is a
   separate per-monitor window named `capture-overlay` (NEVER
   `capture-window`), `layer=TOP`, `exclusivity=IGNORE`, `keymode=NONE`, full
   monitors anchored; the bar keeps `capture-window` at `layer=OVERLAY`,
   `keymode=ON_DEMAND` and owns Enter/Esc. Chrome is CSS-styled GTK (no
   Cairo) so palette refresh needs no new AppearanceSurface step (§11.5).
7. **Esc ladder (normative):** with a mode open (S1/S3) and its pending
   selection engaging, Esc unwinds in this exact order, one action per press:
   (a) clear the pending pick — window unpin, monitor chip back to the
   focused monitor, region rect cleared to an empty overlay ready for a new
   draw — mode stays open; (b) close the mode and hide the overlay (S1→S0);
   (c) from S0, hide the bar. Enter never participates in this ladder.
   Committing bypasses the ladder (overlay locks and is gone).

---

## 5. Bar composition per state (pixel-level normative)

Refer to Sheet 3 for the canonical drawings.

- **S0:** `railicon 📷` `railicon 🎥` `railicon ⚙` — icons only, tooltips
  allowed, no labels at rest.
- **S1 screenshot:** `←` · `📷 (active, blue)` · pills `[Region|Screen|Window]`
  · pills `[delay]` · pills `[PNG|JPEG]` · pills `[→Clipboard|Save]` ·
  `CTA ‘Capture’` (+ `Enter` kbd chip inside the CTA [Sheet 2]).
- **S1 recording (S3 visual):** `←` · `🎥 (active, red)` · pills
  `[Region|Screen|Window]` · pills `[24|30|60]` · `[Low|Med|High]`
  · `[None|Sys|Mic]` · `CTA ‘Record’` red.
- **S4:** `pulse dot` · `MM:SS` · `[⏸ Pause] [⏹ Stop]` · ⚙ (allowed here).
  Chrome visibility follows `bar.recording_hud` (D9, §6): `hidden` / `always`
  / `hover`, default `hidden`; Stop stays reachable in all three.
- Back button: round chevron `←`, 34px, leading position.

Keyboard map (full parity): `Enter` = commit · `Esc` = back one level ·
mode icons focusable/activatable = lane switch · settings via ⚙ on S0.

---

## 6. Settings vocabulary additions

Persisted through the existing GUI-owned store chain
(`domain/settings.ts` + `adapters/glib-settings-store.ts`; corruption degrades
to defaults via `configOneOf`/`configBool` tolerance helpers):

```ts
bar: {
  position: "bottom" | "top"     // default: "bottom"
  offsetPx: number               // default: 0; pixels added beyond auto-detect
  recording_hud: "hidden" | "always" | "hover"  // default: "hidden" (D9)
}
```

`recording_hud` decides S4 chrome visibility while a recording is live:
`hidden` = the bar stays out of the way (videos contain no timer; the ags-bar
indicator is the sole live timer and carries the stop control), `always` = the
Sheet 3 S4 HUD is rendered and therefore appears in recorded frames, `hover` =
the HUD renders only while the pointer is over the bar area (recordings contain
it only during interaction).

Stop MUST remain reachable in every mode: in `hidden`, the user stops through
the ags-bar indicator, and invoking the capture launcher/keybind presents the
bar in its S4 state (HUD visible, Stop available) even mid-recording; presenting
it does not alter the running capture. In `hover`, the bar window is **unmapped**
while chrome is hidden (REQ-006 supersedes the original "stays mapped for its
hit area" wording): a 10–20 Hz compositor pointer poll compares the cursor with
the bar rectangle cached at commit, maps the normal HUD on entry and unmaps it
on exit, so hidden state is fully click-through. REQ-007 narrows that rectangle
from the S1 window to the **configured resting bar** (the S0 rail, 142×54 on the
reference host, not the 1506×54 option lane): the rail is measured while S0 is
visible, then placed with the current monitor geometry, `bar.position` and
`offsetPx`/margins at commit. Nothing else on the edge band (a dock, a
full-width overlay, the empty S1 lane) triggers it. Reveal is armed only after
the pointer leaves once, keeping a commit from the Record CTA out of the first
frame. Once revealed, BUG-003 (v0.2.4) makes the trigger follow the **current
visible surface**: the mapped HUD rect and the open Pause/Stop popover are
unioned with the resting rect for that hover lifetime, with a 200 ms leave
grace and a press guard. This keeps Pause/Stop clickable without widening the
initial hidden trigger; it is still never the 1506×54 S1 lane. When the
recording ends in `hover`, the surface stays unmapped and the poll/footprint
state is cleared; `always`/on-demand presentation still returns to S0.

Existing settings keep their meaning and surface — including
`bar_compact_controls`, which decides **who carries Pause/Stop during S4**:
`true` = bar shows dot+timer only, popup carries pause/stop; `false` = bar
carries the buttons [settings.ts L28–30]. All screenshot/recording options
(font of every pill in S1) map 1:1 from `CaptureSettings`
[settings.ts L16–61]: nothing is dropped in the redesign.

---

## 7. Identity and window architecture (unchanged contracts)

The redesign must NOT touch:

- Identity tuple: `app=capture instance=capture configDir=ags-capture
  mode=live` [app.manifest.json]; window name `capture-window`, launcher
  `capture-ui`, `window#capture-window` CSS selector [AGENTS.md §2].
- Per-monitor live windows + in-place palette refresh through
  `ui/appearance.ts` [README §Runtime contract; AGENTS.md §5]: one window per
  monitor stays live; **D2 means only the focused monitor's window is
  visible** — focus changes re-map visibility instead of closing windows.
- Pure-layer rules: `domain/`, `ports/` stay GTK-free; new overlay/canvas
  code lives in `ui/` + `adapters/`.
- Gates: `make test`, `make conformance`, `make backend` (stock CI);
  `make typecheck`, `make bundle` (local) must pass for every child ticket.

---

## 8. Architecture hand-off flags (RESOLVED 2026-10-30 — see §11)

1. **Selection geometry ownership moves to the AGS overlay (D5/D7).** Today
   the region-draw/window-pick act is delegated one-shot to the backend
   (`bin/capture-tool`) — verify exact plumbing before changing argv. The new
   contract: the overlay owns interactive selection; the backend receives a
   *finished* commit (geometry or window reference). Backend CLI gains an
   explicit-geometry commit path; old interactive path may remain during
   migration but the UI must not use it.
2. **Top-collision auto-detect** (D3) needs a read of other top-anchored
   layer surfaces. Existing adapters (`adapters/hyprland-monitor-focus.ts`,
   `adapters/gdk-monitor-topology.ts`, `adapters/monitor-window-set.ts`) are
   the working pattern; the architect decides probe vs. compositor query vs.
   config-only. Observable acceptance: at default offset, top-anchored bar
   does not overlap `ags-bar`.
3. **New palette-dependent overlay widgets** (dim, selection chrome) require
   an `AppearanceSurface` step per the documented residual
   [README §Residual; AGENTS.md §5].

---

## 9. Functional requirements → acceptance homes

| FR | Requirement (MUST) | AC in |
|----|--------------------|-------|
| FR-1 | One capture surface: bar at rest = 3 icons, focused monitor only, pos/offset configurable | REQ-002 |
| FR-2 | Top placement auto-slots below existing top layer surfaces; manual offset escape hatch | REQ-002 |
| FR-3 | Every existing capability survives 1:1 into S1 pills / settings (cite settings.ts vocab) | REQ-002 |
| FR-4 | Mode open engages pending selection for **both** modes (region rect persists editable; window ring + click-pin; screen outline + monitor chip) | REQ-003 |
| FR-5 | Capture fires **only** on shutter/Enter; commit locks selection irreversibly; Esc unwinds one level per press | REQ-003 |
| FR-6 | Selection geometry owned by AGS overlay; commit passes finished geometry/reference | REQ-003 |
| FR-7 | Red accent convention for recording (chip/pills/CTA + label flip) | REQ-004 |
| FR-8 | S4 live HUD: dot+timer+pause/stop, options locked, `←` suppressed; `bar_compact_controls` governs control placement | REQ-004 |
| FR-9 | Keyboard parity: Enter/Esc/mode-icon switch ⚙-on-S0 | REQ-002/003 |
| FR-10 | Overlay never ships inside a capture; recording commit drops overlay synchronously before first frame | REQ-003 |

## 10. Rejected alternatives (do not resurrect without a new session decision)

- Preset A (strip + popover) and B (full single-row) — lost to C on feel;
  B additionally reshapes on mode switch (Sheet 1).
- Complete-selection-fires capture (the old flow) — replaced by D5/D6.
- Cross-monitor regions — rejected for now (per-monitor architecture; §4.4).
- Selection editing after commit (crop-follow while live) — rejected D6.
- Structural teardown/rebuild refresh — rejected (AGENTS.md §5 residual).

---

## 11. Resolved architecture decisions (2026-10-30 advisory — binds)

All findings carry evidence in the advisory record; implementer must not
re-derive or "improve" these without a new user decision.

### 11.1 Current plumbing (baseline facts)

Region/window/screen selection is one-shot in the backend today: AGS builds
argv (`domain/cli-args.ts` single translator) → `exec-capture-launcher` hides
the window (150 ms) and fire-and-forgets → `bin/capture-tool`
`parse_args` → `resolve_target()` runs `slurp` (region, or `slurp -r` over
`hyprctl -j clients` boxes for window; single-candidate window auto-selects)
→ capture immediately. Screen today = grim all-outputs (no per-monitor).
Recording = same `resolve_target` then `dotfiles-runtime capture`. Backend
stdout is discarded by the launcher — the GUI has no live state feed yet.
Evidence: `bin/capture-tool:194–264,276–344,446–517,1347–1418`;
`ui/classic/ClassicWindow.tsx:254–295`; `adapters/exec-capture-launcher.ts:23–28`.

### 11.2 Overlay — separate `capture-overlay` window

gtk4-layer-shell 1.3 has **no input-region API** (verified: zero
`set_input_region` in GIR). Therefore a full-monitor overlay window on TOP
receives pointer everywhere; it must not sit above the bar. Contract:

- `capture-overlay`: per-monitor, `name="capture-overlay"`,
  `layer=TOP`, `exclusivity=IGNORE`, `keymode=NONE`, anchors all edges,
  margins 0, `gdkmonitor=<monitor>`. Present S1–S3, absent S0/S4 (INV-5).
- Bar stays `capture-window`, `layer=OVERLAY`, `keymode=ON_DEMAND`; it owns
  Enter/Esc and stays clickable above the dim.
- Chrome = CSS-styled GTK widgets (dim bands / bordered boxes / handles /
  ring), NOT Cairo — palette stays in `style.css`. Cairo only with an
  explicit `refreshPaint()` AppearanceSurface step (§11.5).
- Overlay window-set lifecycle mirrors `monitor-window-set` discipline:
  registry register/destroy unregister, no dead-widget refresh.
- Window hover data comes from `AstalHyprland` client rects (GTK4 has no
  global pointer/API); use `address,x,y,width,height,monitor,title`.
- Coordinate caution: GDK monitor geometry is logical; hyprctl/slurp/grim
  coords may differ under scaling or negative origins — verify on scale≠1
  before assuming equality.
- TOP-layer contest with ags-bar (also TOP, EXCLUSIVE 48px, anchored
  TOP|LEFT|RIGHT): acceptable modal block, or inset overlay by
  `reserved_top` (§11.4).

### 11.3 Backend commit path — additive flags only

Keep every existing flag/default; old interactive path remains for
compatibility (UI must not use it):

```
screenshot|start --target region --geometry "X,Y WxH" [--monitor NAME]
screenshot|start --target screen --monitor NAME
screenshot|start --target window --window 0xADDRESS
```

- `--geometry` = finished rect; region path skips `slurp` entirely; validate
  with the existing regex, canonical `X,Y WxH` (never `WxH+X+Y`).
- `--monitor` = per-monitor screen capture via `grim -o NAME` (behaviour
  change vs today's all-outputs, only on the new path); for recording use
  the monitor name instead of `resolve_target("screen")`.
- `--window` = resolve `hyprctl -j clients` by address at commit time (D8);
  vanished client → typed error, NEVER silent slurp fallback.
- TS: add a discriminated `Selection` to requests; append flags at the END
  of `screenshotArgs`/`recordingArgs` so legacy arrays stay byte-identical.
- Tests: python parse/accept/defaults, no-slurp-on-commit (monkeypatch),
  window resolution + vanished address, `grim -o` per monitor; TS exact-argv
  per selection kind + legacy unchanged + region clamp.
Evidence: `bin/capture-tool:254–263,287–322,1353–1418`;
`domain/capture-request.ts:40–80`; `domain/cli-args.ts:65–116`.

### 11.4 Top placement — `reserved_top` + manual offset

Primary: `AstalHyprland.Monitor.reserved_top` (push-based; measured
`[0,48,0,0]` = ags-bar's exclusive zone). Fallback: `hyprctl -j monitors`
`reserved` when unavailable. Final margin = `reserved_top + bar.offsetPx`.
The capture bar MUST NOT be `EXCLUSIVE` (self-offset feedback loop); keep
`IGNORE`/non-exclusive. `reserved_*` cannot see non-exclusive top overlays —
`offsetPx` is the manual escape hatch. Evidence:
`@girs/astalhyprland-0.1.d.ts:668–671,780–792`;
`adapters/hyprland-monitor-focus.ts:50–68`; `ags-bar/bar/Bar.tsx:49–57`.

### 11.5 Palette refresh — CSS-only chrome

`theme.apply()` reloads `style.css`, so CSS-styled chrome (bar, pills, CTA,
badge, dim bands, rect/handles, HUD) needs **no** new AppearanceSurface
step. Icons keep their existing `IconSlots` path. If a Cairo canvas is ever
introduced, add `refreshPaint()` to `AppearanceSurface`, called between
`rebuildIcons` and `refreshWindow` (`lib/appearance.ts:41–49,72–76`), and
re-read the palette only during refresh (never subscribe `wallpaper.state`).

### 11.6 Red accent token (D4) — no literals

The generated palette exposes `@error`, `@warning`, `@color_00..15`; no
dedicated red accent exists. Implementation MUST use a palette token (start
with `@error` as the recording accent; `--rec-accent` CSS var maps to it)
and MUST NOT hardcode a hex (`style.css:10–19` no-literal rule). If the
active theme's `@error` is not red-adjacent, stop and report — do not
invent a second palette source.

### 11.7 S4 live state feed — event bus, not stdout

The launcher discards backend stdout, so S4 must subscribe to
`capture.state {state, elapsed_seconds, job_id}` via
`ags-platform/adapters/event-bus` (proven pattern:
`ags-bar/bar/widgets/recording.tsx:79–97`); Pause/Stop via
`hub.control(job_id, action)`. Coordinate with ags-bar's existing recording
indicator (single indicator or explicit duplication) — do not let two
disagreeing timers ship silently.

### 11.8 Risk register (carry into tasks)

Input regions absent · exclusivity feedback · TOP contest with ags-bar ·
bar keyboard focus loss when overlay maps (re-`present()` after show) ·
second per-monitor window set lifecycle · coordinate spaces (scale/negative
origins) · argv drift (single translator, flags appended) · vanished window
at commit · overlay-in-capture ordering (FR-10 test on call order) · screen
semantics change scoped to new path only · refresh must never show/hide/
resize the pending selection (INV-4) · never resurrect complete-selection=
capture.

### 11.9 "Do NOT do" (normative)

- Rename `capture-window`, touch `app.manifest.json`, `capture-ui` or the
  `window#capture-window` selector; name the overlay `capture-window`.
- Add a second request→argv translator, a second settings/ui-state source,
  or a second app list.
- Keep/restore a slurp call inside the overlay commit path.
- Destroy/recreate per-monitor windows for palette or state changes.
- Subscribe to `wallpaper.state`; hardcode hex colours; make the bar
  `EXCLUSIVE`; read `reserved_top` off itself.
- Cross-monitor regions, post-commit editing, crop/annotation phase.
- GTK/GLib imports in `domain/`, `ports/`, `lib/`.

### 11.10 Implementation sequencing (smallest shippable slices)

- **REQ-002:** S0 rail + S1 per mode on existing option vocabulary; placement
  (`reserved_top` + offset); focused-monitor visibility; legacy commit path
  still used temporarily (documented migration). No overlay yet.
- **REQ-003:** commit 1 = backend `--geometry` + overlay skeleton (dim, rect,
  8 handles, Enter commit, Esc unpin); commit 2 = `--window` + hover ring/pin;
  commit 3 = `--monitor`/`grim -o` + monitor outline/chip + clamp.
- **REQ-004:** commit 1 = red accent token + CTA flip (CSS); commit 2 =
  `capture.state` subscription + S4 HUD + locked options; commit 3 =
  Pause/Stop via event bus + timer continuity check.
