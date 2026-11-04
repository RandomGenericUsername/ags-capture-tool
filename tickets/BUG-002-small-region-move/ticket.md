---
id: BUG-002
title: "Minimal-size region resizes instead of moving when dragged from its centre"
kind: bug
status: triage
lane: direct
severity: medium
links:
  openspec: none
  bmad: none
worktree: none
branch: main
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
