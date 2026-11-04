---
id: REQ-005
title: "Migrate capture CSS to semantic palette.v1 roles"
kind: requirement
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
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

- [x] `style.css` contains zero `@color_*` tokens (including comments); no
      other CSS/TS/TSX file references them.
- [x] Every replacement is a role in the live `palette.v1` vocabulary
      (`@surface`, `@on_surface`, `@primary`, `@on_primary`, `@on_error`,
      `@outline_variant`, `@error`).
- [x] Alpha values, geometry, selectors and the palette-refresh path are
      unchanged.
- [x] `ags-platform` is pinned to v0.4.0 in `Makefile`, CI and tests;
      `contracts` stays v0.3.0.
- [x] A static validation gate fails on any returning `@color_*` carrier.
- [x] `make ci`, `make bundle` and `make typecheck` pass on the branch.
- [x] Visual evidence is captured where Hyprland IPC allows it; otherwise the
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

### Token and role checks

- `git grep -n '@color_' -- '*.css' '*.ts' '*.tsx'` (worktree root) → **no
  matches** (exit 1). The only remaining mentions in the repo are prose: this
  ticket, `CHANGELOG.md`, the validation test's explanatory comments (it is
  `.mjs`, outside the gate's `.css`/`.ts`/`.tsx` scope) and the frozen design
  note `tickets/EPIC-001-capture-bar-redesign/design.md`.
- `rg -o '@[a-z_]+' style.css` after the migration → `@error`, `@on_error`,
  `@on_primary`, `@on_surface`, `@outline_variant`, `@primary`, `@surface`
  (plus the `@keyframes` at-rule). Every one is defined by the live
  `~/.config/ags/colors.css`; a script over that file printed no
  `UNDEFINED` role.
- `tests/validation/theme-roles.test.mjs` (new, run by `make test`) walks every
  `.css`/`.ts`/`.tsx` file, fails on any `@color_*`, pins the required role
  set, and rejects `color: @surface` (page background used as accent ink).
- Geometry/alpha audit: the `style.css` diff changes color tokens and comments
  only. Every `alpha()` literal (0.06, 0.08, 0.1, 0.12, 0.14, 0.22, 0.3,
  0.35, 0.42, 0.45, 0.55, 0.62, 0.85, 0.86, 0.92, 0.96) and every selector,
  radius, padding and size is byte-identical.

### Contrast (live palette, WCAG relative luminance)

Log: `/tmp/opencode/capture-req005-contrast.log` (computed from
`~/.config/ags/colors.css`, palette `e44cd31…`).

| Pair | Ratio |
|---|---|
| `on_surface` on `surface` (body ink) | 14.35:1 |
| `on_primary` on `primary` (selected pills/modes, CTAs) | 7.70:1 |
| `on_error` on `error` (recording chips/CTA/dot) | 7.72:1 |
| `error` on `surface` (settings error, HUD Stop) | 10.92:1 |
| `on_surface` on `surface_container_high` (frozen-template ink) | 11.10:1 |

The old recording CTA used `@color_foreground` on `@error` = **1.31:1**; the
paired `@on_error` fixes it without changing geometry.

### Gates

All logs under `/tmp/opencode/capture-req005-*.log`; implementation commit
`036ec26` on `ticket/REQ-005-theme-roles`.

- `make test` → exit 0: 10/10 `tests/unit.test.mjs`, 1/1
  `tests/validation/theme-roles.test.mjs`, 297/297 `tests/ts`, test-program
  `tsc` → 0 errors.
- `make conformance` → exit 0: 16/16, including the v0.4.0 platform /
  v0.3.0 contracts pin assertion and the platform `checkAppRepo` gate.
- `make backend` → exit 0: 114 passed.
- `make bundle` → exit 0: `build/capture.js`, 1,504,444 bytes.
- `make typecheck` → exit 0: “OK: 0 errors in the ags-capture-tool tree”
  (28 tolerated `/usr/share/ags/js` errors, 0 platform errors).
- Local tuple: `.dev/ags-platform/v0.4.0` is the fetched v0.4.0 tag content
  (annotated tag resolved to `1a5fb14`); `.dev/contracts/v0.3.0` points at the
  `../contracts` checkout. Both gitignored.

### Visual evidence (Hyprland IPC, grim)

Before and after are the **same branch code**, differing only by `style.css`:
- before = `git archive 0cb87f3` (base) in `/tmp/opencode/capture-req005-before`
- after = branch worktree in `/tmp/opencode/capture-req005-app`

Both harnesses got two test-only, uncommitted edits so they photograph the
same lane: `instanceName` (`capture-mig-before` / `capture-mig-visual`) and
the initial bar state `openMode(homeBar(), "screenshot")`. They ran under
isolated `XDG_CONFIG_HOME`/`XDG_STATE_HOME` with the live palette, icons and
`colors.css` symlinked in. Both instances were quit afterwards; the user's
`capture` instance and windows were not replaced, and the bar was left
hidden.

| Shot | Path | Shows |
|---|---|---|
| before S1 bar | `/tmp/opencode/capture-req005-shots/before-bar.png` | legacy `@color_10` selection (dark green) and `@color_06` CTA |
| after S1 bar | `/tmp/opencode/capture-req005-shots/after-bar.png` | `@primary` selection + `@on_primary` ink and `@primary` CTA |
| before full screen | `/tmp/opencode/capture-req005-shots/before-same-full.png` | 1920×1080 original |
| after full screen | `/tmp/opencode/capture-req005-shots/after-full.png` | 1920×1080 original |

Both bars measured **1123×54 at (399,1026)** by `hyprctl layers`, so geometry
did not move. The CTA renders at ~50% because it is insensitive in this state;
that is identical before and after and is not a CSS change.

### Eyeball checklist after deploying

1. Selected mode / target / segment / format pills: `@primary` fill (or ring +
   tint for icon tiles) with dark `@on_primary` text.
2. Capture CTA: `@primary` with `@on_primary` text when enabled; the
   insensitive state still dims it uniformly.
3. Recording lane: `@error` chips/pills/CTA and the pulsing HUD dot; text and
   the record dot use `@on_error` (readable dark ink).
4. Settings error line: `@error` (was the old caution carrier).
5. Path entry border: `@outline_variant` hairline; switch ON: `@primary` track.
6. Panel/bar/badge/hud-popup fills: `@surface`; all ink and hairlines:
   `@on_surface` at the existing alphas.

## Outcome

Implemented on `ticket/REQ-005-theme-roles`; no tag, push or merge. The
`templates/ags-app/` copy was also moved to `@on_surface` + platform v0.4.0 so
a newly generated app cannot inherit the legacy carrier or a stale pin.
