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
}
```

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

## 8. Architecture hand-off flags (input for the architect, blocking FR-10 design)

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
