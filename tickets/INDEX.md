# Ticket index

> Counting rule: completeness checks cover item files (`tickets/<id>-<slug>/ticket.md`) only.
> `tickets/_template/` (and any `tickets/_fixtures/`) are excluded from INDEX completeness counting.
> Entry format: link — title | `status` | execution links. Epics add `done/total children done`, done-when, and one nested line per child. Bugs add severity. Spikes add timebox state.

## Epics

- [EPIC-001-capture-bar-redesign/ticket.md](./EPIC-001-capture-bar-redesign/ticket.md) — Capture bar redesign — state-driven minimalist bar | `done` | 3/3 children done | done-when: bar + selection-first flow + recording lifecycle per `design.md`, all children done and acceptance ticked
  - [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement + on-demand pills (`done`)
  - [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit (`done`)
  - [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD (`done`)
- [EPIC-002-monitor-catalog-dropdowns/ticket.md](./EPIC-002-monitor-catalog-dropdowns/ticket.md) — Shared monitor catalog + capture dropdown UI | `in-progress` | 4/9 children done | done-when: parity harness green, live evidence, runtime v0.6.0 + capture v0.4.0 pinned, no mockup drift | current mockup: `EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html`
  - [REQ-008-shared-monitor-catalog/ticket.md](./REQ-008-shared-monitor-catalog/ticket.md) — Shared monitor catalog service (`done`)
  - [REQ-009-dropdown-primitive-screenshot/ticket.md](./REQ-009-dropdown-primitive-screenshot/ticket.md) — Dropdown primitive + screenshot lane (`done`)
  - [REQ-010-recording-lane-dropdowns/ticket.md](./REQ-010-recording-lane-dropdowns/ticket.md) — Recording lane dropdowns + conditional states (`done`)
  - [REQ-011-dynamic-monitor-dropdown/ticket.md](./REQ-011-dynamic-monitor-dropdown/ticket.md) — Dynamic monitor dropdown + remove cycle chip (`proposed`)
  - [REQ-012-settings-cleanup-persistence/ticket.md](./REQ-012-settings-cleanup-persistence/ticket.md) — Settings cleanup + persistence (`proposed`)
  - [REQ-014-bar-field-presentation/ticket.md](./REQ-014-bar-field-presentation/ticket.md) — Compact/detailed bar field presentation setting (`proposed`)
  - [REQ-013-mockup-parity-harness/ticket.md](./REQ-013-mockup-parity-harness/ticket.md) — Mockup parity harness (`proposed`)
  - [OPS-008-docs-reconciliation/ticket.md](./OPS-008-docs-reconciliation/ticket.md) — Documentation reconciliation (`done`)
  - [OPS-007-release-pins/ticket.md](./OPS-007-release-pins/ticket.md) — Release and pins (`proposed`)

## Requirements

- [REQ-001-migrate-capture-tool/ticket.md](./REQ-001-migrate-capture-tool/ticket.md) — Migrate capture-tool to standalone ags-capture-tool with live refresh | `done` | links: worktree none, branch main
- [REQ-002-capture-bar-shell/ticket.md](./REQ-002-capture-bar-shell/ticket.md) — Capture bar shell: five-state S0–S4, placement, on-demand pills | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-003-selection-first-flow/ticket.md](./REQ-003-selection-first-flow/ticket.md) — Selection-first capture flow: pending protocol + irreversible commit | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-004-recording-lifecycle/ticket.md](./REQ-004-recording-lifecycle/ticket.md) — Recording lifecycle: red accent + live HUD | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-005-theme-roles/ticket.md](./REQ-005-theme-roles/ticket.md) — Migrate capture CSS to semantic palette.v1 roles | `done` | links: worktree none, branch main (merged; worktree/branch removed 2026-11-04)
- [REQ-006-hover-region-reveal/ticket.md](./REQ-006-hover-region-reveal/ticket.md) — Widen S4 hover reveal to the full S1 footprint without click interception | `done` | links: worktree .worktrees/REQ-006/, branch ticket/REQ-006-hover-region-reveal | delivered v0.2.2/PIN-0133; refined by REQ-007 (v0.2.3) and BUG-003 (v0.2.4) | live probe `/tmp/opencode/capture-hover-c/`
- [REQ-007-hover-smart-footprint/ticket.md](./REQ-007-hover-smart-footprint/ticket.md) — Derive the S4 hover footprint from the configured bar rectangle | `done` | links: worktree .worktrees/REQ-007/, branch ticket/REQ-007-hover-smart-footprint | delivered v0.2.3/PIN-0134; exact 142×54 resting rect; expanded controls handled by BUG-003 v0.2.4/PIN-0135 | live probe `/tmp/opencode/capture-hover-smart/`
- [REQ-008-shared-monitor-catalog/ticket.md](./REQ-008-shared-monitor-catalog/ticket.md) — Shared monitor catalog service (`dotfiles-runtime` + capture consumer contract) | `done` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns | design: `EPIC-002-monitor-catalog-dropdowns/design.md`
- [REQ-009-dropdown-primitive-screenshot/ticket.md](./REQ-009-dropdown-primitive-screenshot/ticket.md) — Dropdown primitive + screenshot lane | `done` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [REQ-010-recording-lane-dropdowns/ticket.md](./REQ-010-recording-lane-dropdowns/ticket.md) — Recording lane dropdowns + conditional states | `done` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [REQ-011-dynamic-monitor-dropdown/ticket.md](./REQ-011-dynamic-monitor-dropdown/ticket.md) — Dynamic monitor dropdown + remove cycle chip | `proposed` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [REQ-012-settings-cleanup-persistence/ticket.md](./REQ-012-settings-cleanup-persistence/ticket.md) — Settings cleanup + persistence | `proposed` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [REQ-014-bar-field-presentation/ticket.md](./REQ-014-bar-field-presentation/ticket.md) — Compact/detailed bar field presentation setting | `proposed` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [REQ-013-mockup-parity-harness/ticket.md](./REQ-013-mockup-parity-harness/ticket.md) — Mockup parity harness | `proposed` | links: worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns

## Bugs

- [BUG-001-settings-transparency/ticket.md](./BUG-001-settings-transparency/ticket.md) — Settings panel has no card background and is unreadable over the window behind (C17) | `done` | severity high | lane direct, worktree .worktrees/BUG-FIX/, branch ticket/BUG-FIX-capture-bugs | fixed 2445d44; live v0.2.1 verified 2026-11-04 (`/tmp/opencode/capture-verify-v021/EVIDENCE.md`); JD live-confirmed good 2026-11-04
- [BUG-002-small-region-move/ticket.md](./BUG-002-small-region-move/ticket.md) — Minimal-size region resizes instead of moving when dragged from its centre (C5) | `done` | severity medium | lane direct, worktree .worktrees/BUG-FIX/, branch ticket/BUG-FIX-capture-bugs | fixed 2445d44; live v0.2.1 verified 2026-11-04 (`/tmp/opencode/capture-verify-v021/EVIDENCE.md`); JD live-confirmed at ~30px, accepted at ≥30px 2026-11-04 (minimal-size drag not pursued)
- [BUG-003-hover-controls-collapse/ticket.md](./BUG-003-hover-controls-collapse/ticket.md) — Hover-revealed recording controls unmap when moving to Pause/Stop | `done` | severity high | lane direct, worktree .worktrees/BUG-003/, branch ticket/BUG-003-hover-controls-collapse | JD baseline accepted 2026-11-04; deployed v0.2.4/PIN-0135 | live probe `/tmp/opencode/capture-hover-controls/`; expanded lane measured 243x46 (not 1506)

## Ops tasks

- [OPS-001-release-record-v0.2.0/ticket.md](./OPS-001-release-record-v0.2.0/ticket.md) — Correct the v0.2.0 release record (T1) | `done` | worktree none, branch main | release: v0.2.0 notes corrected 2026-11-04
- [OPS-002-verification-proof/ticket.md](./OPS-002-verification-proof/ticket.md) — Close capture v0.2.0 verification debt (T2): overlay/HUD clips, additive flags, scale≠1 | `done` | worktree none, branch main | evidence: `/tmp/opencode/capture-t2/EVIDENCE.md`
- [OPS-003-reconcile-ticket-state/ticket.md](./OPS-003-reconcile-ticket-state/ticket.md) — Reconcile capture v0.2.0 ticket state (T3): EPIC-001/REQ-003/REQ-004 + INDEX | `done` | worktree none, branch main | EPIC-001 closed 3/3 children 2026-11-04
- [OPS-004-cleanup/ticket.md](./OPS-004-cleanup/ticket.md) — Remove merged REQ-002..005 worktrees/branches and installed v0.1.0 (T5) | `done` | worktree none, branch main | v0.1.0 tag retained as rollback record
- [OPS-005-t4-refinement-intake/ticket.md](./OPS-005-t4-refinement-intake/ticket.md) — Refinement intake for capture v0.2.0 (T4): JD live pass recorded; C5+C17 confirmed, deferred list recorded | `done` | worktree none, branch main | filed BUG-001/BUG-002; v0.2.1 retest closed both and JD live-confirmed them; C3 is expected hover behaviour, positive path verified reachable on probe (no BUG-003); 3 not-bug, 1 accepted, 10 deferred
- [OPS-006-ci-conformance-checkout/ticket.md](./OPS-006-ci-conformance-checkout/ticket.md) — Fix CI conformance: ignore the contracts checkout in the source walk | `done` | worktree none, branch main | root cause: CI checks out contracts inside ROOT; local `.dev` sibling masked it
- [OPS-008-docs-reconciliation/ticket.md](./OPS-008-docs-reconciliation/ticket.md) — Documentation reconciliation: historical mockup/design + stale comments | `done` | worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns
- [OPS-007-release-pins/ticket.md](./OPS-007-release-pins/ticket.md) — Release and pins | `proposed` | worktree .worktrees/EPIC-002/, branch ticket/EPIC-002-monitor-catalog-dropdowns

## Spikes

- [SPIKE-001-hover-region/ticket.md](./SPIKE-001-hover-region/ticket.md) — Widen the S4 hover reveal region during recording | `reported` | timebox 2h | recommendation: pointer-poll reveal (C); implemented by REQ-006 v0.2.2/PIN-0133, refined by REQ-007 v0.2.3/PIN-0134, completed by BUG-003 v0.2.4/PIN-0135 | hover series JD-accepted baseline 2026-11-04; component ownership B in SPIKE-003
- [SPIKE-002-capture-ui-reuse/ticket.md](./SPIKE-002-capture-ui-reuse/ticket.md) — One recording cluster: capture-owned component vs a capture-drawn window | `reported` | timebox 2h | recommendation was A (shared capture-owned component hosted inline, ags-platform UI module, no IPC); **JD chose B 2026-11-04** — capture instance draws the cluster, bar only sends show/update/hide; B design in SPIKE-003
- [SPIKE-003-capture-cluster-ipc/ticket.md](./SPIKE-003-capture-cluster-ipc/ticket.md) — Capture-drawn recording cluster over the AGS request channel (option B) | `reported` | timebox 2h | transport: `ags request capture-cluster '<json>' -i capture` (no new topic); contract, window/stacking, migration, tests, effort 4.5–5.5d; handoff `~/.opencode/plan/handoff-capture-cluster-ipc.md`
- [SPIKE-004-recording-controls-presentation/ticket.md](./SPIKE-004-recording-controls-presentation/ticket.md) — Unify recording-controls presentation across capture and the top bar | `done` | tag: capture v0.3.1 / bar v0.3.0 / platform v0.5.0 | one setting: `top-bar` / `hover` / `always`; `hidden` migrates to `top-bar`; compact disabled/off on hover; live install verified

## Tasks

(none)

## Done (links only, newest last)

(none)
