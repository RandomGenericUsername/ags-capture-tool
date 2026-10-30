---
id: REQ-003
title: "Selection-first capture flow — pending protocol + irreversible commit"
kind: requirement
status: proposed
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: none
---

# Selection-first capture flow

## Requirement

Replace "complete selection = capture" with the pending-selection protocol of
design.md §4 (FR-4/5/6/10): opening a mode engages its selection affordance
immediately; selections stay live and editable until shutter/Enter commits;
commit is a one-way door; the AGS overlay owns selection geometry and hands
the backend a finished commit.

## Acceptance

- [ ] **Region:** on entering Screenshot (or Recording) with Region target,
      the desktop dims and a drawn rectangle **persists** after mouse
      release; drag-inside moves it, any of its 8 handles resizes it, drag on
      the dim = starts a fresh rect (frames Sheet 2 §Region; handles match
      `.selrect/.hx` mock geometry). Release never captures.
- [ ] **Window:** highlight ring follows the pointer across clients with a
      badge (title + size); a click **pins** the client; clicking another
      client re-pins; Esc unpins (then next Esc unmodes). Hover alone never
      captures; pin never captures (frames Sheet 2 §Window).
- [ ] **Screen:** monitor outline is the pending pick; single monitor shows a
      confirmation frame; with >1 monitors a `Monitor n` chip in the bar
      swaps the pick, clicking another screen's outline also swaps
      (frames Sheet 2 §Screen).
- [ ] **Commit:** `Shutter`/`Record` button or `Enter` takes the capture with
      the exact on-screen selection; releasing a drag does not fire (old
      behavior regression-tested as forbidden).
- [ ] **One-way door (D6):** after commit, no state can alter the captured
      region/selection: in recording → only S4 HUD exists; in screenshot →
      selection chrome is destroyed at commit. Design-level proof: the state
      machine (design.md §3) contains no post-commit editing transition;
      test asserts the transition table rejects it.
- [ ] **Overlay never captured (FR-10):** the dim + selection chrome are
      hidden synchronously with the commit and before the backend captures /
      recording starts. Verify: unit test ordering hide→launch; manual grep
      of commit path for no async gap; a recorded 2s clip contains no
      selection UI (manual evidence in ticket).
- [ ] **Overlay surface (design.md §11.2):** selection chrome lives in a
      separate per-monitor `capture-overlay` window (layer TOP,
      exclusivity IGNORE, keymode NONE) — never named `capture-window`; the
      bar stays OVERLAY/ON_DEMAND and retains Enter/Esc; overlay present in
      S1–S3 only, absent S0/S4; unregistered on destroy (no dead-widget
      refresh).
- [ ] **Backend commit flags only additive (design.md §11.3):** legacy argv
      arrays stay byte-identical and the legacy slurp path still works for
      CLI users; the UI path builds `--geometry "X,Y WxH"` / `--monitor` /
      `--window 0x…` and never triggers `slurp` (test: monkeypatched
      `resolve_target` must not be called; vanished window → typed error,
      no slurp fallback). Coordinate-space caution verified: rect correctness
      on one `scale≠1` output and negative monitor origins (§11.2).
- [ ] **Backend contract pivot (D8/§8.1):** commit passes finished geometry
      (region/screen) or a window reference (window) to `bin/capture-tool`;
      domain/argv updated and pure; `domain/`, `ports/` stay GTK-free;
      backend pytest covers the new commit path (`make backend` green).
- [ ] **Region confined to one monitor** by construction: geometry clamped to
      the hosting overlay's monitor bounds (§4 rule 4).
- [ ] Esc unwind = one level per press: unpin (S2) → unmode (S1) → home (S0);
      pinning survives `palette-refresh` (INV-4).
- [ ] Gates: `make test`, `make conformance`, `make backend`,
      `make typecheck`, `make bundle`.

## Evidence

- Old flow (selection delegated one-shot to backend): `bin/capture-tool`
  backend CLI + `domain/capture-request.ts` argv construction — verify the
  exact interactive-selection plumbing before pivoting (design.md §8.1).
- Badge/affordance geometry: `mockups/capture-bar-mockups.html` Sheet 2.
