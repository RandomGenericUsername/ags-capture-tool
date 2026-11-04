---
id: BUG-001
title: "Settings panel has no card background and is unreadable over the window behind"
kind: bug
status: in-progress
lane: direct
severity: high
links:
  openspec: none
  bmad: none
worktree: .worktrees/BUG-FIX/
branch: ticket/BUG-FIX-capture-bugs
repro: "Open the capture bar (`SUPER+PRINT`, or `ags toggle capture-window -i capture`), put a text-heavy window (terminal/editor) behind it, click the ⚙ rail icon, and read the settings labels."
observed: "The Settings view paints no card: labels, group titles, rows and the footer float directly over the text of the window behind. There is no background fill, border, radius or shadow, so the panel is effectively transparent and unreadable (JD screenshot, 2026-11-04)."
expected: "The Settings view paints its own opaque card — the same treatment as `.notif-card` (`background-color: @surface`, border, radius, shadow) or at least the capture bar's `alpha(@surface, 0.92)` plate — while `window#capture-window` stays transparent for the first-frame reason."
---

# Settings panel has no card background and is unreadable over the window behind

## Repro

```sh
# Open the live bar (SUPER+PRINT also works)
ags toggle capture-window -i capture

# Put a text-heavy window behind it, then click the ⚙ rail icon.
# Observed on the live `capture` instance, v0.2.0, 2026-11-04.
```

## Observed

JD's live pass hit this while trying C3 (hover-HUD first frames). Opening
Settings over a text-heavy window showed the labels and rows directly on top of
the window's text: no card surface, no border, no rounded plate, no shadow. The
panel is fully transparent and the settings are unreadable.

Screenshot description: the capture Settings panel is centred over a
text-heavy editor/terminal; the settings text ("Capture settings", group
titles, rows and readouts) is legible only where it happens to land on dark
background, and collides with the text behind everywhere else. There is no
card edge or backdrop separating the panel from the window.

Live evidence attempt: `/tmp/opencode/capture-t4/bar-open2.png` records the
normal S0 bar on the same session as an opaque plate. The Settings surface was
not re-opened during this documentation task because JD was using the live
session; the code path below is the reproducible cause.

## Expected

The Settings view paints a card surface of its own, consistent with the
notification-card precedent (`ags-notifications/style.css:32-38`:
`background-color: @surface` + border + radius + shadow) or the capture bar's
own plate (`style.css:151-156`: `alpha(@surface, 0.92)` + border + radius).
The window stays transparent so the first frame still cannot flash a
rectangle.

## Root cause (read-only investigation)

The window is intentionally transparent, and only the bars paint chrome:

- `window#capture-window { background-color: transparent; }` —
  `style.css:43-46`.
- `.capture-bar` is the element that paints the visible plate —
  `background-color: alpha(@surface, 0.92)`, border and radius —
  `style.css:151-156`.

The Settings view is a **sibling** of the bar rows, not a child of
`.capture-bar`:

- `ClassicWindow.tsx:733-742` creates `.capture-shell` as the vertical stack.
- `ClassicWindow.tsx:1023-1032` mounts `<SettingsPage>` directly inside that
  shell, after the S0/S1/S4 `.capture-bar` boxes.
- `applyBarState()` hides the bar rows when Settings is open
  (`ClassicWindow.tsx:392-395`), so no `.capture-bar` plate is visible.

The Settings subtree supplies no plate of its own:

- Root is `.capture-view`, whose only rule is `min-height: 130px` —
  `SettingsPage.tsx:365-375` and `style.css:423-425`.
- The inner `.settings-page` rule only sets `min-width: 560px` —
  `style.css:573-575`.

So the tree is `transparent window → .capture-shell (no background) →
.capture-view (no background) → .settings-page (no background)`. Nothing in
the Settings state paints `@surface`, hence the transparency.

## Fix notes

Do not fix in this intake task. The fix batch should add the card to the
Settings surface itself — most naturally a background/border/radius/padding
(and shadow) rule on `.capture-view` or a dedicated card wrapper in
`SettingsPage.tsx` — while leaving `window#capture-window` transparent. Reuse
the palette roles (`@surface`, `@on_surface`) so a palette refresh restyles it.
Regression proof: open Settings over a text-heavy window and confirm the panel
is opaque/readable; keep the first-frame no-rectangle behaviour.

## Implementation — 2026-11-04

Branch `ticket/BUG-FIX-capture-bugs`, worktree `.worktrees/BUG-FIX/`, code
commit `2445d44`. Status stays `in-progress` until the orchestrator deploys.

- `.capture-view` now paints its own card: `background-color: @surface`, a
  1px `alpha(@on_surface, 0.12)` border, 18px radius and 18px padding. The
  Settings view is still a sibling of the bar rows.
- `window#capture-window` stays fully transparent, and `.capture-bar` keeps its
  `alpha(@surface, 0.92)` plate unchanged, so the first-frame no-rectangle rule
  and the S0–S4 states are intact.
- No box-shadow: the layer surface is sized to the child, so a shadow would be
  clipped into square corners (same reason as the old `.capture-panel`).
- Regression test: `tests/ts/bar-shell.test.ts:58-75`, "the Settings view paints
  its own opaque card while the window stays transparent".
- Screenshots (grim, text-heavy kitty behind):
  `/tmp/opencode/capture-fix-batch/before-settings-over-text.png` shows the
  transparent labels colliding with the terminal text;
  `/tmp/opencode/capture-fix-batch/after-settings-over-text.png` shows the
  opaque card.
- Gates: `make test` 10/10 unit, 1/1 validation, 300/300 TypeScript, test
  `tsc` clean; `make conformance` 16/16; `make backend` 114 passed;
  `make typecheck` 0 in-tree errors.
- Tradeoff: the card is fully opaque `@surface` rather than the bar's 0.92
  plate, and adds 18px padding to the Settings surface. The bar's geometry and
  every selector/state are unchanged.

**Evidence:** `style.css:423-435`; `tests/ts/bar-shell.test.ts:58-75`; commit
`2445d44`.

**Verify:** open Settings over a text-heavy window; the panel must have an
opaque fill and a visible card edge, while the S0 bar keeps its translucent
plate.

## Evidence

- `style.css:43-46` — window background transparent.
- `style.css:151-156` — `.capture-bar` is the plate.
- `style.css:423-425` — `.capture-view` has min-height only.
- `style.css:573-575` — `.settings-page` has min-width only.
- `ui/classic/SettingsPage.tsx:365-375` — root `.capture-view` /
  `.settings-page` markup.
- `ui/classic/ClassicWindow.tsx:733-742` — `.capture-shell` stack.
- `ui/classic/ClassicWindow.tsx:1023-1032` — SettingsPage is a sibling of the
  bars.
- `ui/classic/ClassicWindow.tsx:392-395` — bar rows hidden while Settings is
  open.
- `ags-notifications/style.css:32-38` — opaque notification-card precedent.
- Live pass: JD, 2026-11-04; observed screenshot description above.

**Verify:** after the fix, open Settings over a text-heavy window and compare
it with the opaque S0 bar; the panel must have the same readable card quality.
