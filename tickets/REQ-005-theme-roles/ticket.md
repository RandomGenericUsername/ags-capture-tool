---
id: REQ-005
title: "Migrate capture CSS to semantic palette.v1 roles"
kind: requirement
status: in-progress
lane: direct
links:
  openspec: none
  bmad: none
worktree: .worktrees/REQ-005/
branch: ticket/REQ-005-theme-roles
---

# Migrate capture CSS to semantic palette.v1 roles

## Requirement

Replace every legacy `@color_*` reference in `style.css` with the semantic
`palette.v1` role names that `ags-platform` v0.4.0 projects into the one
composed provider. Legacy carriers resolve to unrelated Material roles under
tpr, so the migration maps by **intent per site**, not by carrier index.
Geometry, spacing, radii, alpha values, selectors and behaviour do not change.
Only the color token (and the paired ink where a solid fill changes polarity)
changes.

> Ticket id note: the request named this `REQ-002-theme-roles`, but REQ-002 is
> already `REQ-002-capture-bar-shell` (and `.worktrees/REQ-002/` is occupied).
> The next free id, REQ-005, is used here; the slug remains `theme-roles`.

## Acceptance

- [ ] `style.css` contains zero `@color_*` tokens (including comments); no
      other CSS/TS/TSX file references them.
- [ ] Every replacement is a role in the live `palette.v1` vocabulary
      (`@surface`, `@on_surface`, `@primary`, `@on_primary`, `@on_error`,
      `@outline_variant`, `@error`).
- [ ] Alpha values, geometry, selectors and the palette-refresh path are
      unchanged.
- [ ] `ags-platform` is pinned to v0.4.0 in `Makefile`, CI and tests;
      `contracts` stays v0.3.0.
- [ ] A static validation gate fails on any returning `@color_*` carrier.
- [ ] `make ci`, `make bundle` and `make typecheck` pass on the branch.
- [ ] Visual evidence is captured where Hyprland IPC allows it; otherwise the
      exact eyeball checklist is recorded.

## Migration table

Legend: **old** is the CSG carrier the stylesheet was written against; **role**
is the tpr semantic role. Live palette values on this host (`e44cd31…`):
`on_surface #eee0d5`, `surface #19120c`, `primary #fcb974`, `on_primary
#492900`, `error #ffb4ab`, `on_error #690005`, `outline_variant #51453a`.

| Old token | Site (selector) | Role | Rationale |
|---|---|---|---|
| `@color_foreground` | all text/ink plus `alpha()` hairlines/washes | `@on_surface` | The stylesheet's ink role; every foreground site is text or a hairline derived from text ink. |
| `@color_background` | `.overlay-dim`, `.bar-group`, `.mode-switch`, `.target`, `.segment`, `.custom-duration spinbutton`, `.kbd`, `.path-chip`, `.path-entry`, spinbutton backgrounds | `@surface` | These are translucent surface fills; the old carrier was the base surface (`#19120c`, same as `color_00`). |
| `@color_background` | active rail icon, selected bar pill, active mode, selected segment (text) | `@on_primary` | Inverted ink on a solid `@primary` fill, never the page background. |
| `@color_00` | `.capture-bar`/`.selbadge`/`.hud-popup`/`.capture-panel` fills, `.selhandle` ring | `@surface` | Panel/dish background and the dark ring around a selection handle. |
| `@color_10` | `.selrect`, `.selring`, `.mon-outline.selected`, `.railicon.active`, `.bar-pill.selected`, `.mode-switch button.active`, `.target.selected`, `.segment.selected`, comments | `@primary` | The one selection accent: solid fills, rings, 6–12% tints. Text on those solid fills moves to `@on_primary`. |
| `@color_06` | `.bar-cta`, `.primary` fills and their shadow tint | `@primary` | The action accent/CTA; `@primary`/`@on_primary` is the producer-guaranteed pair. |
| `@color_06` | `.path-entry` border | `@outline_variant` | The comment-free site is a muted hairline; old `color_06` resolved to `#51453a`, exactly this role. |
| `@color_06` | `switch.palette-switch:checked` track/border | `@primary` | ON/selected control state. |
| `@color_03` | `.settings-error` text | `@error` | The class is a settings error message; the old "caution" comment is rewritten to the error role. |

### Paired ink (polarity changes)

| Old ink | On | New ink | Why |
|---|---|---|---|
| `@color_background` | `@primary` solid fills | `@on_primary` | Paired role for the accent; 7.70:1. |
| `@color_foreground` | `@primary` CTA fills | `@on_primary` | The old foreground guess was tuned for a dark steel action slot; under v1 `@primary` is bright, so paired ink is required. |
| `@color_background` / `@color_foreground` | `@error` recording fills | `@on_error` | Recording reuses `@error` as a solid accent; `@on_error` keeps the recording controls readable (7.72:1 instead of 1.31:1). |

## Ambiguous sites

- `@color_10` was `#404b25`, which is exactly `tertiary_container`, but every
  site uses it as **selection** (fill/ring/tint), not as an attention color.
  Mapped to `@primary` per the role's intent, accepting the hue change.
- `@color_06` was `#51453a` (exactly `outline_variant`) but also drives the
  primary CTAs and switch-on state. The CTA/switch sites map to `@primary`;
  only the `.path-entry` hairline maps to `@outline_variant`. This is the one
  carrier split by intent.
- `.overlay-dim` is conceptually a scrim, but it was `@color_background` at
  55% and the requirement is visual parity; mapped to `alpha(@surface, 0.55)`
  rather than `@scrim` (black).
- Recording ink: the instruction's "inverted text on accent -> `on_primary`"
  is applied to the `@primary` accent. The recording accent is `@error`, whose
  paired ink is `@on_error`; using `on_primary` there would be semantically
  wrong and no more readable. Recorded here instead of guessed silently.
- `.record-dot` was described as "light on the accent". Its old light ink
  (`@color_foreground`) on `@error` is 1.31:1; `@on_error` is used so the glyph
  remains visible.

## Evidence

Gates and screenshots are recorded below once the branch gates run.
