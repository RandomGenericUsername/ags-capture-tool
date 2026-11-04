---
id: BUG-002
title: "Minimal-size region resizes instead of moving when dragged from its centre"
kind: bug
status: done
lane: direct
severity: medium
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-FIX/
branch: ticket/BUG-FIX-capture-bugs
repro: "Open 📷 → Region, draw a minimal-size rectangle (~15×15), release, then drag from the rectangle's centre."
observed: "The centre drag starts a resize (a handle is hit) instead of a move; the rectangle grows/shrinks from an edge or corner and cannot be repositioned from its middle."
expected: "A drag from the interior moves the whole rectangle; resize handles take over only near their own edges/corners."
---

# Minimal-size region resizes instead of moving when dragged from its centre

## Repro

```text
1. Open the capture bar and choose 📷 Screenshot.
2. Choose Region.
3. Draw a minimal-size rectangle, approximately 15×15 logical px.
4. Release, then press inside the rectangle's centre and drag.
```

## Observed

The drag from the centre resizes the rectangle instead of moving it. On a
~15×15 rect there is effectively no interior left: every point is within a
handle's hit radius, so the pointer is treated as a resize target (JD live
pass, 2026-11-04, C5).

## Expected

The interior of the rectangle is a move surface. Handles should own only the
neighbourhood of their own edges/corners; a minimal rectangle still has to be
movable from its middle.

## Root cause (read-only investigation)

Hit-testing is handle-first and uses a generous radius:

- `HANDLE_ORDER` lists the four corners before the four edges —
  `domain/selection.ts:65-74`.
- `HANDLE_SIZE = 9` and `HANDLE_HIT_RADIUS = 9` — `domain/selection.ts:77-79`.
- `hitHandle()` accepts any point within ±9 px of a handle centre, iterating
  the eight points in that corner-first order — `domain/selection.ts:198-209`.
- `beginRegionDrag()` calls `hitHandle()` **before** `containsPoint()`, and
  returns immediately on a hit — `ui/overlay/SelectionOverlay.tsx:237-255`.

For a ~15×15 rect the handles sit on the corners and edge midpoints, all
within 9 px of the centre, so `hitHandle()` wins before the move branch can
run. The larger the hit radius relative to the rect, the more of the interior
becomes a resize target.

## Fix notes

Do not fix in this intake task. Candidate fixes for the batch: when the rect
is small, prefer `containsPoint()`/move over handle resize for interior
points; or shrink/skip handle hit-testing once the rect dimension is at or
below `2 × HANDLE_HIT_RADIUS`; or clamp handle hit boxes to the rect. Add a
domain-level regression test that a centre point of a normalised 15×15 rect
does not resolve to a handle, and an interaction check that a centre drag
produces `kind: "move"`.

## Implementation — 2026-11-04

Branch `ticket/BUG-FIX-capture-bugs`, worktree `.worktrees/BUG-FIX/`, code
commit `2445d44`. Status stayed `in-progress` until deploy; closed by the
v0.2.1 verification below.

- `handleHitRadius()` now clamps each axis to
  `min(HANDLE_HIT_RADIUS, max(0, floor((dimension - 1) / 3)))`. For a 15×15
  rect that is 4px, leaving the centre outside every handle zone; a normal
  200×100 rect keeps the full 9px pointer radius.
- `regionPressAt()` classifies one press as `resize` / `move` / `null`
  (outside), and `SelectionOverlay.beginRegionDrag()` uses it. The centre move
  branch therefore cannot be pre-empted by a handle in a minimal rect, while
  corners and edges still own their own neighbourhoods.
- Tests: `tests/ts/selection.test.ts:152-190` — minimal-rect centre moves,
  minimal-rect corner/edge resizes, normal-rect centre move, normal corner/edge
  resizes, and outside → fresh draw. Existing negative-origin, clamping and
  coordinate tests remain green.
- Gates: `make test` 10/10 unit, 1/1 validation, 300/300 TypeScript, test
  `tsc` clean; `make conformance` 16/16; `make backend` 114 passed;
  `make typecheck` 0 in-tree errors.
- Tradeoff: on very small rects the handle hit area shrinks with the rect
  (4px on 15×15) instead of staying a fixed 9px; that is the price of
  guaranteeing a move zone. Resize remains available at the exact corners and
  edges.

**Evidence:** `domain/selection.ts:200-245`;
`ui/overlay/SelectionOverlay.tsx:237-256`;
`tests/ts/selection.test.ts:152-190`; commit `2445d44`.

**Verify:** draw a ~15×15 rect, drag from its centre, and confirm the whole
rect translates; then drag a corner/edge and confirm resize still works.

## Verification — v0.2.1 live (2026-11-04)

Status moved `in-progress` → `done` after the deployed `v0.2.1` instance was
re-tested (pin `v0.2.1`, config → `apps/capture/v0.2.1`, PID 902796).

- Minimal region: drew `(400,400)` → `(415,415)` (badge `15×15 · editable`),
  then dragged the centre `(407,407)` → `(507,507)`. Badge stayed
  `15×15 · editable`; the accent/handle bbox moved from
  `(398,398)–(421,421)` to `(498,498)–(521,521)` — exactly **+100,+100**, 279
  pixels both times. Size unchanged.
  Evidence: `/tmp/opencode/capture-verify-v021/tiny-region-drawn.png`,
  `tiny-region-moved.png`.
- Normal region: drew `(300,250)` → `(500,370)` (badge `200×120 · editable`),
  centre drag `(400,310)` → `(450,360)` kept `200×120` and translated
  **+50,+50** (`normal-region-drawn.png`, `normal-region-moved.png`).
- Corner resize: bottom-right `(550,420)` → `(600,450)` produced badge
  `250×150 · editable` with the top-left fixed at `(350,300)`
  (`normal-region-resized.png`).
- Full write-up: `/tmp/opencode/capture-verify-v021/EVIDENCE.md`.
- Live state after: capture still running `v0.2.1`, HUD setting restored to
  `hidden`, wallpaper unchanged, `dotfiles-runtime doctor` clean (21 items).

**Result:** fixed; centre move, corner resize and normal-size move all pass.

## JD acceptance — v0.2.1 (2026-11-04)

JD re-checked the live `v0.2.1` instance after the verification evidence:

- A small region at **~30 px** moves from its centre and resizes from its
  handles as expected; JD considers this **good**.
- The minimal-size (~15 px) centre-drag case is **accepted as out of scope**:
  *"accepted at ≥30px; minimal-size drag not pursued."*
- Status stays `done`. No min-size constraint or further code change is added
  unless a new ticket is opened.

## Evidence

- `domain/selection.ts:65-74` — corner-first `HANDLE_ORDER`.
- `domain/selection.ts:77-79` — 9 px handles / 9 px hit radius.
- `domain/selection.ts:198-209` — `hitHandle()` radius test.
- `ui/overlay/SelectionOverlay.tsx:237-255` — handle check before
  `containsPoint()`, resize wins.
- `ui/overlay/SelectionOverlay.tsx:252-255` — move branch only reached when no
  handle matched.
- Live pass: JD, 2026-11-04, C5 confirmed (minimal rectangle, centre drag
  resizes).

**Verify:** draw a ~15×15 rect, drag from the centre, and confirm the whole
rect translates; then drag an edge and confirm resize still works.
