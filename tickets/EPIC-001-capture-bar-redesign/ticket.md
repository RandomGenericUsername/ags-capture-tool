---
id: EPIC-001
title: "Capture bar redesign — state-driven minimalist bar"
kind: epic
status: done
lane: bmad-advisory
links:
  openspec: none
  bmad: none
worktree: none
branch: none
children: [REQ-002, REQ-003, REQ-004]
done-when: "Bar, selection-first flow and recording lifecycle all ship per design.md; every child requirement done with its acceptance checklist ticked."
---

# Capture bar redesign — state-driven minimalist bar

> **Release-record handoff (2026-11-04):** [release-handoff-2026-11-04.md](./release-handoff-2026-11-04.md) — T1–T5 owned by the refactor agent; the acceptance/ETA response is under §7 of that file.

> **Closed 2026-11-04 (T3):** all three children are `done` and every child
> acceptance box is ticked. T2 verification evidence lives in
> `/tmp/opencode/capture-t2/EVIDENCE.md` and
> [OPS-002](../OPS-002-verification-proof/evidence.md); the reconciliation is
> recorded in [OPS-003](../OPS-003-reconcile-ticket-state/ticket.md).

## Done-when

All three child requirements are `done` and the composition holds: the capture
tool's GUI is a state-driven minimalist bar (not a three-page panel) that keeps
every existing capability, adds the selection-first capture flow with an
irreversible commit, and preserves the live palette-refresh and identity
contracts. UX frame of reference: `design.md` (this ticket) plus
`mockups/capture-bar-mockups.html`.

## Context

Emerged from a UX session (2026-10-30, Sally/BMAD + JD). The prior
three-page panel (ui/classic: Screenshot/Recording/Settings pages) is replaced
by a five-state bar machine S0–S4. Full normative spec, decision log and
rejected alternatives live in [design.md](./design.md).

## Children

- [x] `REQ-002` — Capture bar shell: five-state S0–S4, placement + on-demand pills (`done`)
- [x] `REQ-003` — Selection-first capture flow: pending protocol + irreversible commit (`done`)
- [x] `REQ-004` — Recording lifecycle: red accent + live HUD (`done`)

## Done-when evidence (2026-11-04)

- **REQ-002 `done`** — five-state bar shell, placement and on-demand pills;
  acceptance checklist fully ticked at its ticket.
- **REQ-003 `done`** — selection-first flow + `capture-overlay` window; all
  acceptance boxes ticked. T2 closed the two formerly open proofs:
  pending-selection chrome absent from the app's own Region+MP4 clip
  (`/tmp/opencode/capture-t2/clips/pending-selection-app-region.mp4`), and the
  backend flags additive (legacy argv + `slurp` path green).
- **REQ-004 `done`** — recording lifecycle + S4 HUD; all acceptance boxes
  ticked. T2 recorded `hidden` → no capture-bar HUD
  (`.../clips/hud-hidden-screen.mp4`) and `always` → HUD present
  (`.../clips/hud-always-screen.mp4`), then restored `hidden`.
- **Scale caveat:** T2 measured one scaled output with a positive origin
  (`eDP-1` 1.25); a scaled output with a negative monitor origin remains
  unit-tested only (`tests/ts/selection.test.ts:204-220`) and was not measured
  on hardware.

Evidence index: `/tmp/opencode/capture-t2/EVIDENCE.md`; repo copy
[OPS-002](../OPS-002-verification-proof/evidence.md).

## Freeze superseded by v0.2.0 (record corrected)

**Original freeze decision (2026-10-31 20:54, JD) — kept verbatim:**

> **Implementation on ags-capture-tool is frozen.** Main stays at the last green
> commit (`d720c2b`, plus documentation-only commits). No new code, merges, tags
> or provisioning until the parallel CSG/theme-producer migration settles.
>
> Why: live use surfaced L3/L4 wiring defects (interactions, popups, commit
> paths) that have not been attributed yet, while theme-producer is still
> changing palette semantics (`BUG-002`, `v0.5.0 on_backdrop`). Fixing now would
> mix two moving variables and risk blaming the refactor for palette/CSG drift.
>
> Frozen state: REQ-002 done; REQ-004 done (recorded-clip proof outstanding);
> REQ-003 in-progress (two hardware ACs); EPIC-001 in-progress.

**Superseded by release.** The freeze was overtaken by `v0.2.0` without a
separate unfreeze commit: REQ-005 code landed 2026-11-01 23:04, the annotated
tag `v0.2.0` was cut at `1897607` on 2026-11-01 23:09:15 -0500, and
`dotfiles-v3` pinned it at 23:09:40 (`aad9fd22`, PIN-0126). This record was
corrected on 2026-11-04 (T1); the tag message remains the original
REQ-005-only text and the deployed pin stays at `v0.2.0`.

The freeze's stated unfreeze condition ("theme/CSG migration settles") was not
met at release time: theme-producer shipped `v0.5.1` on 2026-11-04 07:54 and
its `EPIC-003` closed 2026-11-04 10:14. The record therefore treats the release
as a supersession to reconcile, not as evidence that the condition held.

Debt linked to this supersession (both items now closed):

- **T2 — verification (closed 2026-11-04):** overlay-never-captured clip
  (FR-10), HUD `hidden` vs `always` clip, additive backend flags, and one
  positive-origin `scale≠1` pick. Evidence:
  [OPS-002](../OPS-002-verification-proof/ticket.md) /
  [`evidence.md`](../OPS-002-verification-proof/evidence.md) and
  `/tmp/opencode/capture-t2/EVIDENCE.md`. Caveat: negative-origin scaled
  output is unit-tested only.
- **T3 — ticket-state reconciliation (closed 2026-11-04):** EPIC-001, REQ-003
  and REQ-004 frontmatter/INDEX/reality now agree; all children and acceptance
  boxes are closed. Recorded in
  [OPS-003](../OPS-003-reconcile-ticket-state/ticket.md). The epic was
  `in-progress` at 2/3 children until this reconciliation; it is now `done`.

The attribution protocol and unfreeze criteria below are retained as
historical context; they are no longer a live gate.

### Attribution protocol (historical)

1. Reproduce on the **deployed old build** (`~/.config/ags-capture`, installed
   tag) under the current palette. Same failure there ⇒ environment / palette /
   backend, not this refactor.
2. Check the surface's palette tokens against the generated
   `~/.config/ags/colors.css` (named roles + `color_00..15` aliases).
3. Confirm backend argv/commit path parity for capture/recording behaviour.
4. Classify: `refactor-wiring` | `palette-csg-drift` (blocked) |
   `pre-existing-backend` | `spec-gap`.

### Unfreeze criteria (historical)

- CSG/theme-producer migration declared complete and palette vocabulary frozen.
- Old app re-verified on the new palette.
- Feedback captured as bug tickets (`repro:`, `observed:`, `expected:`) and
  triaged by the protocol above.
- Then reopen REQ-003 verification and file a hardening epic for L4 wiring.

