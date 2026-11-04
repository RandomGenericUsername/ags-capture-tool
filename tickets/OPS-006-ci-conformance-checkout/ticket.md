---
id: OPS-006
title: "Fix CI conformance: ignore the contracts checkout in the source walk"
kind: ops-task
status: done
lane: direct
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# Fix CI conformance: ignore the contracts checkout in the source walk

## Why

`gh run list` showed `failure` on every push since the first commit (`08e8e71`,
2026-10-28), including `main` at `b5a6315` (2026-11-04). The sole failing test
was `tests/app-contract.test.mjs:344`:

```text
not ok 15 - no source subscribes to wallpaper.state for palette application
  wallpaper.state must not drive this app: contracts/generated/contract.ts
```

CI checks out `contracts` at `$GITHUB_WORKSPACE/contracts` — inside the app's
`ROOT`. The source walk ignored `.dev`, `.worktrees`, etc. but not `contracts`,
so the contract's own topic table was scanned as app source. Locally `contracts`
is a sibling reached through `.dev/contracts/v0.3.0`, which is ignored, which is
why `make conformance` was green here and red in CI. This is a test-harness
path bug, not a product regression.

## Work

- Add `contracts` to the `walk()` ignore list in `tests/app-contract.test.mjs`,
  with a comment naming the CI checkout path.
- Reproduce the CI layout locally: create `contracts/generated/contract.ts`
  containing `wallpaper.state`, run the test (fails pre-fix), apply the fix,
  re-run (passes), then remove the temporary directory.
- Run the full CI gate (`make ci`) locally.

## Done-when

The simulated CI layout passes `tests/app-contract.test.mjs`; `make ci` exits 0;
the change is pushed to `main` and the next CI run is green.

## Evidence

- **Pre-fix, simulated CI checkout:** `✖ no source subscribes to wallpaper.state
  for palette application` → `wallpaper.state must not drive this app:
  contracts/generated/contract.ts`.
- **Post-fix, same simulation:** `✔ no source subscribes to wallpaper.state for
  palette application`; `tests 16 / pass 16 / fail 0`.
- **`make ci`:** test `10/10` + `297/297`; conformance `16/16`; backend `114
  passed`; exit 0.
- **CI:** [run 41904573613](https://github.com/RandomGenericUsername/ags-capture-tool/actions/runs/41904573613)
  on `ec906f7` — **success** (first green run since `08e8e71`).
