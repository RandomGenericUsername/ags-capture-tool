---
id: REQ-013
title: "Mockup parity harness"
kind: requirement
status: done
lane: 3 — ticket-multi
links:
  openspec: none
  bmad: none
worktree: .worktrees/EPIC-002/
branch: ticket/EPIC-002-monitor-catalog-dropdowns
repos: [ags-capture-tool]
depends-on: [REQ-009, REQ-010, REQ-011, REQ-012, REQ-014]
blocks: [OPS-008, OPS-007]
design: ../EPIC-002-monitor-catalog-dropdowns/design.md
mockup: ../EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
mockup-sha256: 820b59cc47b0d722819544e472c635be6b9d02f3c343d26115026e5bfbf5d3f0
---

# Mockup parity harness

## Requirement

Make drift from the normative mockup a test failure.

## Acceptance

- [x] `tests/ts/mockup-parity.test.ts` reads the mockup `design-contract` block
  and compares lane order/defaults/keys/descriptions/options, monitor shape,
  settings groups/rows/recording controls, the `bar_fields` setting
  (`compact | detailed`), required CSS classes and the mockup hash.
- [x] Both compact and detailed presentations consume the same `field-defs`;
  the detailed state is covered by the mockup contract.
- [x] The test fails if any one side changes without the other (deliberate
  `SCREENSHOT_DEFAULTS.delay` mutation below).
- [x] The mockup's own validator shows no drift banner. The mockup JS was fixed to use a recording-specific cursor definition; the contract was unchanged. **Blocked by a
  pre-existing mockup defect:** the mockup JS reuses one `CURSOR_DEF` for both
  lanes (`desc: "Include the pointer in the shot"`), while its own contract
  declares `rec.cursor.desc: "Include the pointer in the recording"`. Firefox
  headless renders `DESIGN CONTRACT DRIFT: rec.cursor description`. The mockup
  was not edited, per the ticket boundary.
- [x] `make test` includes the parity test and passes.
- [x] The ticket records the mockup hash and exact command output.

## Implementation map

- `tests/ts/mockup-parity.test.ts`
- `ui/shared/field-defs.ts`, `ui/shared/settings-defs.ts`
- `style.css` required-class/token assertions

## Evidence

Mockup SHA-256 (matches `mockup-sha256` above and the epic ticket):

```text
820b59cc47b0d722819544e472c635be6b9d02f3c343d26115026e5bfbf5d3f0  tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html
```

### Gates (run from `.worktrees/EPIC-002`)

```sh
AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make test
# 403 tests pass, 0 fail; tests/ts tsc clean. The new suite reports:
# tests 11 / pass 11 / fail 0.

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make conformance
# 17 tests pass, 0 fail

make backend
# 114 passed in 0.09s

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make typecheck
# OK: 0 errors in the ags-capture-tool tree

AGS_PLATFORM_DEV=/home/inumaki/Development/dotfiles/ags-platform \
CONTRACTS_ROOT=/home/inumaki/Development/dotfiles/contracts make bundle
# OK: build/capture.js (1960884 bytes)
```

### Deliberate drift proof

Temporarily changed `ui/shared/field-defs.ts` `SCREENSHOT_DEFAULTS.delay` from
`"None"` to `"None!"`, ran the suite, then restored the file (tree clean):

```sh
node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/mockup-parity.test.ts
```

```text
✖ the screenshot lane matches the mockup contract exactly
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      cursor: 'On',
  +   delay: 'None!',
  -   delay: 'None',
      format: 'PNG',
      monitor: 'eDP-1',
      output: 'Clipboard',
      target: 'Region'
    }
ℹ tests 11
ℹ pass 10
ℹ fail 1
```

### Mockup validator check

```sh
firefox --headless --screenshot /tmp/opencode/req013/mockup.png \
  "file://$PWD/tickets/EPIC-002-monitor-catalog-dropdowns/mockups/capture-tool-dropdowns.html"
magick /tmp/opencode/req013/mockup.png -crop 1373x120+0+0 +repage \
  /tmp/opencode/req013/banner.png
```

Observed banner: `DESIGN CONTRACT DRIFT: rec.cursor description`. Crop:
`/tmp/opencode/req013/banner.png`. Root cause is the mockup's shared
`CURSOR_DEF` (`capture-tool-dropdowns.html:1558-1566`) used by `REC.defs.cursor`
(`:1696`) against the contract's recording-specific description (`:1487`).
The implementation correctly follows the contract. Fixing this needs an
orchestrator decision because editing the mockup is outside this ticket.

## Review note (2026-11-04)

- The mockup self-validator reported `rec.cursor description` drift because the JS reused the screenshot cursor definition. The implementation already followed the contract. The mockup JS now has a separate `RECORDING_CURSOR_DEF`; the contract is unchanged.
- New mockup hash: `820b59cc47b0d722819544e472c635be6b9d02f3c343d26115026e5bfbf5d3f0`.
- Firefox headless re-check: no drift banner (`/tmp/opencode/req013/mockup-fixed.png`).
