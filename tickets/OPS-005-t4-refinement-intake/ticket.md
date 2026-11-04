---
id: OPS-005
title: "Refinement intake for capture v0.2.0 (T4) — JD live pass recorded, tickets filed"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Refinement intake for capture v0.2.0 (T4)

> `ops-task` MAY be read as `chore` (Shortcut mapping); the file MUST still declare `kind: ops-task`.
> An `ops-task` SHALL NOT declare a `parent:`. Trivial ops tasks may skip OpenSpec/BMAD ceremony but never skip git discipline (main-clean check + worktree + ticket branch).

## Why this exists

T4 of the [release handoff](../EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md)
asks for a refinement backlog, but JD has no written list. This ticket is the
**intake only**: a read-only audit of the shipped refactor that turns the known
rough edges into a candidate list JD can confirm or reject during a live pass.

**Intake is complete.** The lifecycle gate (`tickets/LIFECYCLE.md:22-29`)
rejects a bug without `repro:` / `observed:` / `expected:`. Rows below were
shaped to those fields, and after the live pass only the confirmed behaviours
became tickets (`BUG-001`, `BUG-002`). Nothing in this ticket changes code, the
`v0.2.0` tag, the deployed pin, or runtime state.

## How the list was built

Read-only inspection of:

- `tickets/EPIC-001-capture-bar-redesign/design.md` and `REQ-002..REQ-005`
  (acceptance prose, "verification limits", "design notes / deviations",
  "spec contradiction", freeze record).
- `CHANGELOG.md` v0.2.0 "Known verification limits".
- Source comments and code paths in `ui/`, `domain/`, `adapters/`, `lib/`,
  `bin/`, `style.css`.
- `git log v0.1.0..v0.2.0` (no commit message mentions a fix, refinement or
  deferral; the only correction commits are the T1–T5 docs commits after the
  tag).
- Live log `~/.local/state/ags/capture.log` (PID 511294 / `gjs:511326`).

**Status legend** used inside the `observed` column:

- `known from artifact` — stated by a ticket/design/code path; no live click
  required to accept that the current behaviour exists.
- `needs live confirmation` — the code makes the behaviour likely but the
  visible result (or whether it is undesirable) is unmeasured.
- `needs live confirmation (speculative)` — edge case inferred from code; JD
  may never hit it.

**Repro shorthand.** "Open the bar" means run `ags request toggle -i capture`
or press the provisioned *Open capture UI* keybind. S0 is the three-icon rail
(📷 🎥 ⚙); S1 is one mode open. All steps assume the live `capture` instance,
not a temporary one.

**Old-vs-new caveat.** T5 removed the installed `v0.1.0` app directory; the
`v0.1.0` tag still exists. A differential needs
`git worktree add /tmp/opencode/capture-v010 v0.1.0` plus isolated
`XDG_CONFIG_HOME`/`XDG_STATE_HOME`, as REQ-005 did for its visual comparison.

## Candidate behaviours

| # | area | repro (what to do) | observed (current behavior, sourced from code/design/ticket) | expected | severity | old-vs-new needed? | source (path:line) |
|---|---|---|---|---|---|---|---|
| C1 | S1 screenshot CTA copy | Open the bar → tap 📷 → Region → drag a rect → read the CTA, then press Enter. | `known from artifact` — the CTA reads **Capture**. design.md §5 draws `Capture`; §3/§4, Sheet 2/3 and REQ-003 acceptance prose say `Shutter`. REQ-003 records this as an unresolved spec contradiction, not a silent rename. | One term everywhere: JD picks `Capture` or `Shutter`, and the label, ticket and design agree. | low | no | `tickets/REQ-003-selection-first-flow/ticket.md:328-332`; `tickets/EPIC-001-capture-bar-redesign/design.md:60,135`; `ui/classic/ClassicWindow.tsx:405-410` |
| C2 | S4 settings entry | Start a recording; while the HUD is live, look for ⚙ or try to open Settings. | `known from artifact` — the S4 row is dot + timer + Pause/Stop only; no ⚙. design.md §5 says "⚙ (allowed here)"; REQ-004 records the omission as a deliberate deviation from INV-3 (settings is S0-only) and options-locked. | Decide: add an S4 settings entry, or amend design §5 so the mockup and the implemented row agree. | low | no | `tickets/REQ-004-recording-lifecycle/ticket.md:329-333`; `tickets/EPIC-001-capture-bar-redesign/design.md:139`; `ui/classic/ClassicWindow.tsx:908-1021` |
| C3 | `recording_hud=hover` first frame | Settings → Recording HUD = **On hover** → open 🎥 → Region → drag → click **Record** with the pointer still over the bar → record ≥5 s → stop and inspect the clip while watching the bar. | `needs live confirmation` — `enterLiveHud()` does not reset `pointerInside`; `hudVisibility("hover")` shows chrome whenever the pointer is inside. Clicking Record leaves the pointer over the bar, so the HUD can be mapped from the first frame and stay visible until the pointer leaves. | Recording starts with clean frames; the HUD appears only after a fresh pointer entry after commit — or JD explicitly accepts the current behaviour. | medium | yes (hover HUD is new; v0.1.0 had no S4 HUD) | `ui/classic/ClassicWindow.tsx:298-310,681-698`; `domain/recording-hud.ts:95-110` |
| C4 | Window pick stacking | Open two overlapping windows (e.g. a terminal over a browser) → open 📷 → **Window** → hover and click the overlap. | `needs live confirmation` — `hitClient()` returns the first client in the AstalHyprland list order; that order is not a documented stacking order, so the ring/pin may resolve to a lower window. | The topmost client under the pointer is picked. | medium | maybe (old path used `slurp -r` over `hyprctl` boxes; stacking order there is also unproven) | `domain/selection.ts:226-237`; `adapters/hyprland-window-clients.ts:62-90`; `ui/overlay/controller.ts:227-241` |
| C5 | Small region move/resize | 📷 → **Region** → draw a rect about 15×15 → release → drag from its centre to move it, then try an edge handle. | `needs live confirmation` — `HANDLE_HIT_RADIUS` is 9 px with 9 px handles and corners are checked first. Every interior point of a sub-≈18 px rect is within some handle radius, so a centre drag is treated as a resize, not a move. | Interior drag moves the rect; handles take over only near their own edges. | medium | no (new overlay) | `domain/selection.ts:62-79,199-209`; `ui/overlay/SelectionOverlay.tsx:237-262` |
| C6 | Screenshot delay feedback | 📷 → **Region** → set delay **10s** → draw a rect → press Capture → watch the screen for the next 10 s. | `known from artifact` — commit hides the overlay and the bar before `launcher.launch`; the backend then sleeps the delay after selection. Nothing on screen says a capture is pending. | A countdown/indicator, or the bar stays visible showing "capturing in Ns". | medium | maybe (backend delay is pre-existing; the new flow removes the panel that used to be the only surface) | `ui/classic/ClassicWindow.tsx:510-530`; `bin/capture-tool:354-372` |
| C7 | Enter inside Settings | Open ⚙ → click **Bar position: Top** → press Enter. | `known from artifact` — `enterAction("settings")` maps to `closeSettings()`, so Enter saves and closes from anywhere in the page. The footer advertises **Enter = save**, so this may be intended. | Confirm. If only the inline path editor should consume Enter, narrow the capture-phase handler. | low | no | `ui/classic/ClassicWindow.tsx:558-566`; `domain/bar-state.ts:72-76`; `ui/classic/SettingsPage.tsx:398-404` |
| C8 | Lane switch discards pending | 📷 → **Region** → draw a rect → tap 🎥 → tap 📷 again. | `known from artifact` — `selectMode()` re-begins the session when the lane changes; the pending rect/pin is not carried across. | Confirm whether a lane round-trip should restore the previous pick, or whether a fresh lane always starts empty. | low | no | `ui/classic/ClassicWindow.tsx:417-425`; `domain/selection-session.ts:31-34` |
| C9 | Window ring needs motion | Open 📷 or 🎥 → **Window** → enter the lane with the pointer already resting over a client and do not move it. | `known from artifact` — `hoverAt()` is called only from the motion handler; there is no initial sample when the lane opens, so no ring/badge appears until the pointer moves. | The ring appears on the client under a stationary pointer when the lane opens. | low | no | `ui/overlay/SelectionOverlay.tsx:315-323`; `ui/overlay/controller.ts:234-241` |
| C10 | Drag survives a missed release | 📷 → **Region** → start drawing → move the pointer to another monitor, release there, then move back over the overlay. | `needs live confirmation (speculative)` — `pointerDown` is cleared only by the overlay's own click `released` handler; motion trusts it. A release delivered outside the widget can leave the drag armed. | Release anywhere ends the drag; re-entry never continues a drag without a held button. | low | no | `ui/overlay/SelectionOverlay.tsx:86-89,294-327` |
| C11 | Hover ring responsiveness | 📷 → **Window** → sweep the pointer quickly across several clients and watch the ring. | `needs live confirmation (speculative)` — every hover change re-reads the full Astal client list and re-renders every overlay host; there is no throttle. Whether that reads as lag is unmeasured. | The ring tracks the pointer without visible lag. | low | no | `ui/overlay/controller.ts:150-160,234-241`; `adapters/hyprland-window-clients.ts:62-90` |
| C12 | Boot hydration timeout | Restart capture (or log in) and `tail -f ~/.local/state/ags/capture.log`; if a recording is already live, start the app and open the S4 HUD. | `known from artifact` — one boot-time line: `capture-CRITICAL: event-bus: hydration of capture.state failed: Gio.IOErrorEnum: Timeout` (2026-11-04 07:58:52). The app-side feed adds no retry of its own; subscribe-before-read hydration belongs to the platform client. | Hydrate/retry without a CRITICAL, or document the startup ordering so a missed hydration is expected. | medium | yes (event bus is new in v0.2.0) | `~/.local/state/ags/capture.log:139`; `lib/capture-state-feed.ts:26-38`; `adapters/platform-capture-state-feed.ts:1-18` |
| C13 | GTK throttling warnings | Open the bar, drag a region, sweep the window target; tail the log. | `known from artifact (inconclusive)` — recurring `Gdk-WARNING … gdk_frame_timings_throttling_hint` lines, e.g. 11:11:51, 11:16:58, 11:18:01, 11:24:59. GTK-internal, not app logic. | No visible jank. If jank correlates, profile the overlay render path; otherwise close as noise. | low | no | `~/.local/state/ags/capture.log:178-184` |
| C14 | Astal client assertion | Restart capture; read the log around startup. | `known from artifact` — `Json-CRITICAL … json_node_get_string` plus `CRITICAL … astal_hyprland_hyprland_get_client: assertion 'address != NULL'` at 07:43:40. No capture source calls `get_client`, so attribution is open (Astal internals vs adapter). | Attribution recorded; no assertion on a clean start. | low | no | `~/.local/state/ags/capture.log:135-137` |
| C15 | Unattributed L3/L4 defects | Ask JD to name what he hit before the 2026-10-31 freeze; reproduce each on v0.2.0. | `known from artifact` — the freeze record says live use surfaced "L3/L4 wiring defects (interactions, popups, commit paths) that have not been attributed yet". No repro was recorded. | JD names each behaviour. Only then can a bug ticket pass the lifecycle gate. | unknown | yes | `tickets/EPIC-001-capture-bar-redesign/ticket.md:77-80` |
| C16 | Default `recording_hud=hidden` | Start a recording with defaults; look for a capture-bar timer/Stop while live. | `known from artifact` — the default is `hidden`: the bar is not mapped automatically and ags-bar is the sole live timer/Stop. The launcher presents the capture-bar HUD on demand. | Confirm JD expects no capture-bar HUD by default (D9) or wants `always`/`hover` as the shipped default. | low | yes (S4 HUD is new) | `domain/settings.ts:69`; `tickets/REQ-004-recording-lifecycle/ticket.md:280-307`; `domain/recording-hud.ts:58-76` |

## JD live pass — 2026-11-04

JD ran the pass on the live `v0.2.0` instance. C5 was confirmed, and while
trying C3 he found a bigger new defect: the Settings panel has no card
background and is unreadable over the window behind (C17). C17 is now the
second filed bug. The rest of the list is recorded below as **not a bug**,
**accepted**, **unconfirmed**, or **deferred / not pursued**.

| # | area | verdict | result / reason | follow-up |
|---|---|---|---|---|
| C5 | Small region move/resize | **confirmed** | Drawing a minimal-size rectangle (~15×15) and dragging from its centre resizes instead of moves. | `BUG-002-small-region-move` (medium). |
| C17 | Settings panel background | **confirmed** (new; not in the original 16) | While trying C3, JD opened Settings (his note calls it the "S4 Settings panel"): the panel has a fully transparent background. Labels float directly over the text-heavy window behind; there is no card, border or readable surface. | `BUG-001-settings-transparency` (high). |
| C3 | `recording_hud=hover` first frame | **unconfirmed** | Not tested: the C17 Settings defect interrupted the hover-HUD attempt. | Re-run after BUG-001 is fixed; no ticket now. |
| C6 | Screenshot delay feedback | **not a bug** | Capture appears after 10 s as expected. | None. |
| C1 | Capture vs Shutter CTA | **not a bug** | "Capture" is fine. | None; spec wording can stay as implemented. |
| C9 | Window ring absent until pointer moves | **accepted** | JD accepted/liked the current behaviour; not a bug. | None. |
| C16 | Default `recording_hud=hidden` = no timer | **not a bug** | Confirmed true; by design D9. Only becomes a change if JD explicitly wants the timer by default. | None. |
| C2 | Settings ⚙ inside S4 | **deferred** | The design allows a ⚙ inside the recording popup and it is not there; a missing-feature question, not a confirmed bug. | Not pursued; no ticket. |
| C4 | Window pick stacking | **deferred** | Two overlapping windows / which one gets picked was not understood; edge case. | Not pursued; no ticket. |
| C7 | Enter inside Settings | **deferred** | Pressing Enter in any settings field saves and closes the panel; minor UX question. | Not pursued; no ticket. |
| C8 | Lane switch discards pending pick | **deferred** | Switching Screenshot ↔ Recording lanes while a selection is pending throws the selection away; minor. | Not pursued; no ticket. |
| C10 | Drag survives a missed release | **deferred** | Speculative edge case: a release outside the overlay could leave a drag armed. | Not pursued; no ticket. |
| C11 | Hover ring responsiveness | **deferred** | Speculative: a fast sweep may look laggy; not measured. | Not pursued; no ticket. |
| C12 | Boot hydration timeout | **deferred** | Restarting capture while a recording is live can leave the HUD unhydrated after a log timeout; edge case. | Not pursued; no ticket. |
| C13 | GTK throttling warnings | **deferred** | GTK log noise; ignore unless visible jank is actually seen. | Not pursued; no ticket. |
| C14 | Astal client assertion | **deferred** | Astal log assertion; ignore unless it correlates with a crash or visible defect. | Not pursued; no ticket. |
| C15 | Unattributed L3/L4 defects | **deferred** | The freeze record named unattributed interactions/popups/commit paths, but JD supplied no specific behaviour to reproduce. | Nothing to file until JD names one. |

**Tally:** 2 confirmed (C5, C17), 3 not a bug (C1, C6, C16), 1 accepted (C9),
1 unconfirmed (C3), 10 deferred (C2, C4, C7, C8, C10–C15). The confirmed items
each have exactly one ticket; nothing in the deferred list was filed.

### T2 test residue in JD's screenshot

The "Capture failed — segment join failed" toast visible in JD's screenshot is
**T2 test residue** from
`rec_tmp/.../rec-geometry.mp4`, not a normal product failure. T2's geometry
proof deliberately started and stopped a backend recording; the leftover temp
segment triggered the toast. It is not a new bug and has no ticket. See
`/tmp/opencode/capture-t2/EVIDENCE.md` and `OPS-002-verification-proof/`.

## Named design / verification limitations (not bugs unless JD re-decides)

These are deliberate scope or measurement limits. They are listed so the live
pass does not re-litigate them accidentally; each becomes a ticket only if JD
explicitly changes the decision.

| # | limitation | current decision | old-vs-new needed? | source |
|---|---|---|---|---|
| L1 | Cross-monitor region selection | Rejected for v0.2.0: region is clamped to the hosting monitor; per-monitor overlays are the deployment unit. | no | `tickets/EPIC-001-capture-bar-redesign/design.md:24-32,107-108,239-246`; `domain/selection.ts:116-135` |
| L2 | Annotation / post-commit region editing | Parked non-goal; commit is a one-way door (D6). | no | `tickets/EPIC-001-capture-bar-redesign/design.md:24-32,239-246` |
| L3 | `scale≠1` with a **negative-origin** monitor | Unit-tested only; T2 measured a positive-origin output at scale 1.25. Not ticked as hardware-verified. | no | `tickets/REQ-003-selection-first-flow/ticket.md:311-322`; `tickets/EPIC-001-capture-bar-redesign/ticket.md:61-64` |
| L4 | `recording_hud=hover` keeps a hit-area strip | Deliberate: the bar stays mapped with chrome at opacity 0 so pointer entry can reveal Pause/Stop; that strip is not click-through. | no | `domain/recording-hud.ts:70-75`; `ui/classic/ClassicWindow.tsx:242-272` |

## Live pass script (JD drives; agent records)

Order is chosen to touch each surface once and to avoid a second recording
setup. Keep `tail -f ~/.local/state/ags/capture.log` running in another
terminal; note timestamps for anything that becomes a bug.

1. **Preflight.** Confirm `cat ~/.local/share/dotfiles/apps/capture/pinned` is
   `v0.2.0`, `ps -o pid,lstart,cmd -p 511294` is the live process, and the log
   tail is clean. If the app restarted, capture the startup lines first (C12,
   C14).
2. **S0 and placement.** Open the bar; note the resting width/position and
   whether it is on the focused monitor. Press Esc once; open again. Confirm
   the hide/reopen feel matches expectation.
3. **Screenshot region basics.** 📷 → Region → draw, move, resize, drag a fresh
   rect. Check the badge text and the CTA label (C1). Confirm release never
   fires a capture. Draw a ~15×15 rect and try to move it (C5).
4. **Esc ladder.** With a rect pending, press Esc once (rect should clear, mode
   stays open), twice (mode closes), from S0 (bar hides). Note any mismatch
   with what JD expects.
5. **Window pick.** 🎥/📷 → Window. Hover, pin, re-pin, click empty space, Esc
   unpin. Then reproduce C4 with two overlapping windows, C9 with a stationary
   pointer, and C11 with a fast sweep.
6. **Screen pick.** On one monitor, confirm the outline/confirmation frame and
   that `Capture` is enabled without an extra click. If a second output is
   available, exercise the `Monitor n` chip and clicking another outline.
7. **Screenshot delay.** Set 10 s, draw a region, press Capture, and watch C6.
   Note whether JD wants a countdown. Do one clipboard shot and one save shot.
8. **Recording — hidden (default).** Confirm Setting is `Hidden`. 🎥 → Region →
   draw → Record. Verify the bar disappears, ags-bar carries the timer, and a
   5 s clip contains no capture-bar HUD. Use the launcher mid-recording to
   present the HUD and Stop; confirm the recording is untouched.
9. **Recording — always.** Settings → Recording HUD = Always. Repeat a 5 s
   recording; confirm the S4 HUD is visible and recorded. Pause/Resume once and
   check the timer freezes, then Stop. (Existing T2 evidence covers the clip;
   this is the live feel check.)
10. **Recording — hover.** Settings → Recording HUD = On hover. Repeat,
    clicking Record with the pointer on the bar, and inspect C3 plus the L4 hit
    area. Restore the setting to `Hidden` before finishing.
11. **Settings.** Open ⚙. Change Bar position (Top then Bottom), Top offset,
    Recording HUD, and one toggle. Press Enter from a pill (C7). Use an inline
    path editor: Enter saves the path, Esc cancels it. Confirm no setting is
    silently lost.
12. **Lane switching.** Draw a region in 📷, switch to 🎥, switch back (C8).
    Note whether the lost pick is expected.
13. **Boot anomaly follow-up.** If a restart happened during the pass, grep the
    log for `hydration` and `astal_hyprland` (C12, C14) and check whether the
    S4 HUD hydrated. If no restart happened, schedule one explicitly.
14. **Closeout.** Read each candidate back to JD as `repro / observed /
    expected`; mark **confirm**, **reject** (with reason), or **needs old-vs-new**.
    For each confirm, file one bug ticket from `tickets/_template/bug.md` with
    all three fields plus severity, and add it to INDEX in the same commit.

## Done-when

- [x] JD has confirmed or rejected every C-row (and explicitly re-decided or
  kept each L-row). C3 is recorded as unconfirmed because the C17 defect
  interrupted it.
- [x] Every confirmed behaviour has exactly one bug ticket with `repro:`,
  `observed:`, `expected:` and a severity; rejected/accepted/deferred rows are
  recorded here with the reason.
- [x] This ticket is marked `done` and INDEX is updated in the same commit.
- [x] No code, tag, deployed-pin or runtime change is made by this intake.

## Closeout

T4 intake is complete (2026-11-04). Filed from the live pass:

| Ticket | Behaviour | Severity | Status |
|---|---|---|---|
| [BUG-001](../BUG-001-settings-transparency/ticket.md) | Settings panel transparent / unreadable over the window behind (C17) | high | `triage` |
| [BUG-002](../BUG-002-small-region-move/ticket.md) | Minimal-size region resizes instead of moves from its centre (C5) | medium | `triage` |

Not filed: C1/C6/C16 are not bugs, C9 is accepted, C3 is unconfirmed, and
C2/C4/C7/C8/C10–C15 are deferred (plain-language reasons in the table above).
The T2 toast residue is noted above and is not a product failure. This commit
is docs-only; BUG-001 and BUG-002 are for the next fix batch, not this task.

## Provenance / what this list is not

- It is **not** a substitute for the live pass. Rows marked
  `needs live confirmation` are inferences from code paths, not observed
  failures.
- It does **not** include the already-closed T2 verification items (overlay in
  clip, HUD in clip, additive backend flags) except where a live-feel question
  remains (C3, C16).
- It does **not** resurrect rejected alternatives from design.md §10
  (complete-selection-fires, cross-monitor regions, post-commit editing,
  structural teardown refresh).
- The `v0.1.0..v0.2.0` commit messages contain no fix/refinement/deferral
  entries; the only "correction" commits after the tag are the T1–T5 docs
  commits. Nothing was hidden in history.
