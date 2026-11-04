---
id: EPIC-001
title: "Capture bar redesign — state-driven minimalist bar"
kind: epic
status: in-progress
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
- [ ] `REQ-003` — Selection-first capture flow: pending protocol + irreversible commit (`in-progress`)
- [x] `REQ-004` — Recording lifecycle: red accent + live HUD (`done`)

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

Open debt linked to this supersession:

- **T2 — verification:** overlay-never-captured clip (FR-10), HUD `hidden` vs
  `always` clip, and `scale≠1` geometry. Tracked in
  [OPS-001](../OPS-001-release-record-v0.2.0/ticket.md).
- **T3 — ticket-state reconciliation:** EPIC-001, REQ-003 and REQ-004
  frontmatter/INDEX/reality alignment. This epic stays `in-progress` (2/3
  children) until the children and acceptance genuinely close.

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

