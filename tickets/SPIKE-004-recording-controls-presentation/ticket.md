---
id: SPIKE-004
title: "Unify recording-controls presentation across capture and the top bar"
status: investigating
owner: JD
created: 2026-11-04
repos:
  - ags-capture-tool
  - ags-bar
  - ags-platform (only if the shared port option is chosen)
worktree: .worktrees/SPIKE-004/
branch: ticket/SPIKE-004-recording-controls-presentation
---

# SPIKE-004 — unify recording-controls presentation

## Why

The capture tool and the top bar now both render recording controls:

- the capture tool's own S4 bar (`bar.recording_hud` = `hidden | always | hover`);
- the top bar's capture-drawn cluster (always shown while `capture.state` is live).

`always` and `hover` therefore produce **two** live control surfaces. `hidden`
accidentally produces only the top-bar one. The user wants one setting that
chooses the surface: **Top bar**, **On hover**, or **Always visible**.

This is a cross-app presentation seam, not a one-line setting rename. Decide the
owner, the migration, and the visibility contract before coding.

## Current behavior (evidence)

| Piece | Current setting | Actual behavior |
|---|---|---|
| Capture S4 hover bar | `bar.recording_hud` | `hidden` / `always` / `hover` |
| Top-bar cluster | none | visible whenever `capture.state !== "idle"` |

- Capture enum/default/merge: `domain/settings.ts:29`, `:69`, `:84-88`,
  `:146-150`.
- Capture visibility rule: `domain/recording-hud.ts:97-115`.
- Capture applies it: `ui/classic/ClassicWindow.tsx:480-516`, `:528-540`.
- Settings UI: `ui/classic/SettingsPage.tsx:208-220`.
- Bar visibility: `bar/widgets/recording.tsx:342-346` (`visible: value !== "idle"`).
- Bar reads only `bar_compact_controls`: `bar/widgets/recording.tsx:65-67`.
- Bar requests capture to draw its slot: `bar/lib/cluster-request.ts`,
  `bar/domain/cluster-slot.ts`, `capture/lib/request-dispatch.ts`.

Consequence:

- `always` / `hover` → top-bar cluster **and** capture hover bar can both appear.
- `hidden` → top-bar cluster still appears; capture hover bar stays hidden.

## Proposed user-facing model

One setting, three modes:

| Mode | Top-bar cluster | Capture hover bar | Capture S4 |
|---|---|---|---|
| `top-bar` | visible while recording | never | suppressed |
| `hover` | hidden | only while pointer is over its region | S4 hover |
| `always` | hidden | always visible | S4 always |

Keep `bar_compact_controls` separate: it is orthogonal (“compact popover” vs
“full inline buttons”), not a location.

Recommended labels: **Top bar**, **On hover**, **Always visible**.

## Settings schema and migration

Proposed new field (top level, not under `bar`, because it is not capture-bar
specific):

```json
{
  "recording_controls": "top-bar"
}
```

Values: `"top-bar" | "hover" | "always"`.

Migration from the old field:

| Old `bar.recording_hud` | New `recording_controls` | Why |
|---|---|---|
| `hidden` | `top-bar` | Preserves today’s visible behavior: top-bar only |
| `hover` | `hover` | Same capture-bar behavior, now top bar hidden |
| `always` | `always` | Same capture-bar behavior, now top bar hidden |
| missing/unknown | `top-bar` | Default to the top bar, never a second surface |

If both keys exist, the new `recording_controls` wins. The old key must remain
readable for one release and should not be written again. The settings UI writes
only the new key.

Default: `top-bar`. This preserves the current top-bar-only default and removes
the old `hidden` name from the user surface.

Open: whether `hidden` remains as an advanced fourth mode. Recommendation:
remove it from the UI; migrate it to `top-bar`. If a “no automatic controls”
mode is still wanted, it should be a separate explicit mode, not the legacy
default.

## Pure rule (prototype in this spike)

`domain/recording-presentation.ts` defines:

```ts
type RecordingControlsMode = "top-bar" | "hover" | "always"
interface RecordingSurfaces {
  topBar: boolean
  captureBar: "hidden" | "always" | "hover"
  allowLauncherHud: boolean
}
```

Invariant: exactly one automatic control surface per mode.

- `top-bar` → `{ topBar: true, captureBar: "hidden", allowLauncherHud: false }`
- `hover` → `{ topBar: false, captureBar: "hover", allowLauncherHud: false }`
- `always` → `{ topBar: false, captureBar: "always", allowLauncherHud: false }`

The legacy migrator is pure and tolerant: `migrateRecordingHud(value)` returns
the new mode, and `resolveRecordingControls(newValue, legacyValue)` prefers the
new value.

The capture-side `hudVisibility()` will consume `captureBar` later. The bar's
visibility predicate will consume `topBar` later. Do not wire either until the
mode semantics are agreed.

## Architecture options

The current option-B coupling is deliberate: the bar owns the slot, capture owns
the rendering. The new setting adds one more cross-app fact.

1. **Capture config + pure rule in capture, duplicated in bar (minimal).**
   The bar already reads `bar_compact_controls` from `capture-tool` via the
   Preferences port. Add the new key the same way. Keep one pure rule in capture
   and a tiny bar copy, pinned by a shared fixture test.
   - Pro: no platform release/pin coordination; smallest change.
   - Con: two copies of the rule; the bar still reads capture config.

2. **Platform port (recommended if the rule is permanent).**
   Add `ags-platform/ports/recording-presentation.ts` with the enum, migration
   and surface rule. Both apps import it. This matches the existing
   `capture-cluster` port and gives one source of truth.
   - Pro: one rule; explicit contract; testable.
   - Con: another platform pin bump/coordination; app branches wait on platform.

3. **Capture publishes presentation through `capture.state`.**
   The bar reads a presentation field instead of capture config.
   - Pro: capture owns the decision; bar stops reading capture config.
   - Con: mixes UI policy into a domain event, or adds a new topic; contract
     churn.

4. **Bar renders the shared component.**
   - Pro: no IPC for rendering.
   - Con: reintroduces timer/state/popover/action ownership in the bar; this is
     the duplication option B removed.

Recommendation for the prototype: **option 1**. If the mode proves stable,
move the pure rule to the platform (option 2) with the next platform pin.

## Open decisions

1. `hidden`: remove from the UI and migrate to `top-bar`, or keep as a fourth
   advanced mode?
2. In `top-bar` mode, if the capture UI is opened while recording, should the
   capture S4 row be suppressed, or allowed as a manual override?
3. Is `bar_compact_controls` staying separate? (Recommended: yes.)
4. Should the setting live in capture-tool config for now, or wait for a shared
   runtime/platform setting?
5. Does “top bar” mean always visible while recording, or only on hover over the
   top bar? (Current top-bar cluster is always visible.)

## Acceptance

- Exactly one automatic surface for each mode/state.
- `top-bar`: no capture hover bar; top-bar cluster visible while recording.
- `hover`: no top-bar cluster; capture bar reveals on pointer entry.
- `always`: no top-bar cluster; capture bar always visible.
- `bar_compact_controls` still moves Pause/Stop between inline and popover.
- Setting change before recording applies to the next recording.
- Bar restart and capture restart keep the chosen surface recoverable.
- Old configs migrate without crashing; unknown values fall back to `top-bar`.
- No new hub topic; no event-contract change.
- Multi-monitor: no duplicate cluster; the chosen surface appears once per
  relevant monitor.

## Non-goals

- No implementation of the bar/settings wiring in this ticket yet.
- No tag, push, merge, pin bump or deploy.
- No `tickets/INDEX.md` edit; the orchestrator owns rollup.
- No new event topic.

## Next steps

1. Agree on the open decisions.
2. Add the pure `recording-presentation` rule and tests (prototype in this
   worktree).
3. Wire settings migration in capture; wire the bar visibility predicate.
4. Live-probe the three modes, including capture/bar restart and multi-monitor.
5. Decide whether the rule moves to `ags-platform`.

## Prototype status (this worktree)

Added:

- `domain/recording-presentation.ts` — `RecordingControlsMode`,
  `recordingSurfaces()`, `migrateRecordingHud()`,
  `resolveRecordingControls()`.
- `tests/ts/recording-presentation.test.ts` — 5 tests covering the default,
  the exactly-one-surface invariant, legacy migration, new-key precedence and
  the closed value set.

Verify:

```sh
node --test tests/ts/recording-presentation.test.ts
# 5 pass
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform/.worktrees/SPIKE-003 \
  make test
# 336 pass; tests/tsconfig.tests.json typecheck clean
```

Not wired yet: `domain/settings.ts`, `SettingsPage.tsx`, `ClassicWindow.tsx`,
and `ags-bar/bar/widgets/recording.tsx`. Those wait on the open decisions above.
