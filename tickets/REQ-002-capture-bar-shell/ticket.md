---
id: REQ-002
title: "Capture bar shell — five-state S0–S4, placement, on-demand pills"
kind: requirement
status: proposed
lane: 4
links:
  openspec: none
  bmad: none
worktree: none
branch: none
---

# Capture bar shell

## Requirement

Implement the bar shell per
[tickets/EPIC-001-capture-bar-redesign/design.md](../EPIC-001-capture-bar-redesign/design.md)
§3–§7: the S0–S4 state machine, preset-C composition with the leading back
button, bottom/top placement with auto-slot and manual offset, focused-monitor
visibility, and 1:1 migration of all existing pill options and settings —
without touching the identity tuple, window name or palette-refresh contract.

## Acceptance

- [ ] Bar at rest (S0) is a single widget group anchored bottom (default) on
      the focused monitor containing exactly `📷 · 🎥 · ⚙` icon buttons, no
      labels, ≤ 210px wide (frame: Sheet 3 `S0`).
- [ ] `app.manifest.json` identity unchanged (`app/instance=capture`,
      `configDir=ags-capture`, `mode=live`, `holdsUnsavedState: false`);
      launcher `capture-ui` still toggles; `style.css` still selects
      `window#capture-window`. Verify: `make conformance` passes unchanged
      manifest checks.
- [ ] One live window per monitor survives (appearance registry contract);
      only the focused monitor's window is visible, and focus changes re-map
      visibility without destroying/recreating windows or resetting shared
      UI state. Verify: a TS test in the style of
      `tests/ts/state-preservation.test.ts` covering two monitors.
- [ ] `←` chevron (34px round) leads every opened state; tapping it or `Esc`
      returns to S0; tapping the other mode icon switches lanes without
      returning home (INV-2; transition table design.md §3).
- [ ] S1 screenshot pills carry exactly the existing screenshot vocabulary
      from `domain/settings.ts` L16–34: target (Region/Screen/Window),
      delay, format (png/jpeg), output (clipboard/save), cursor — every
      option still user-reachable; none dropped.
- [ ] ⚙ opens the settings surface from S0 only (INV-3); dirs, filename
      pattern, notifications and rendering settings survive.

- [ ] Placement persisted as `bar.position` (`bottom` default) and
      `bar.offsetPx` (default 0) through the existing UI-state store chain;
      corrupt/missing values degrade to defaults via `configOneOf`/
      `configString` tolerance, no throw (settings tolerance rule,
      settings.ts L63–73).
- [ ] Top placement (design.md D3/§11.4): margin = `AstalHyprland.Monitor.reserved_top` (+ `hyprctl -j monitors` `reserved` fallback) + `bar.offsetPx`; verified no overlap with ags-bar (48px reserved zone) at offset 0; the bar MUST NOT be EXCLUSIVE (no self-offset feedback). Manual verification scenario documented in ticket evidence.
- [ ] `baseline` regression: `make test`, `make conformance` green;
      `make typecheck`, `make bundle` green locally.

## Evidence

- Current settings vocabulary: `domain/settings.ts` L22–61 (`CaptureSettings`)
  — screenshot {format, output, cursor}, recording {fps, quality, audio,
  cursor} + dirs/pattern/notifications/bar_compact_controls.
- Refresh invariants that must survive: `README.md` §Runtime contract,
  `AGENTS.md` §5; UI-state store chain: `adapters/glib-ui-state-store.ts`.
