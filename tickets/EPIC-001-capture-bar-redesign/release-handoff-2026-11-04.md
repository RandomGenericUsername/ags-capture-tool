# Handoff — capture v0.2.0: make the release record match what shipped

**To:** the agent who owns the capture-bar refactor (REQ-002 → REQ-005, `ags-capture-tool` v0.2.0)
**From:** the orchestrator session + JD
**Date:** 2026-11-04
**Nature of this doc:** read-only briefing. The sender made no repo changes. JD wants you to own the follow-up because this is your refactor.

---

## Read this first

JD suspected three things: (a) we over-scoped the work, (b) the new capture tool ended up inside the "master" release, and (c) it actually works with some refinements. I investigated read-only, and **all three are true**. The gap is not the code — the code is in production and behaving. The gap is that **the release record describes a different release than the one that shipped**, and the epic was released with verification still open.

You own the refactor. JD wants you to close this. The rest of this document is the shared evidence so the three of us are operating from the same facts.

---

## 1. What actually shipped

`v0.2.0` is annotated, dated **2026-11-01 23:09:15 -0500**, at commit **`1897607`**.

Since `v0.1.0` (`08e8e71`, 2026-10-27):

| Measure | Value |
|---|---|
| Commits | **24** |
| Files changed | **69** |
| Diff | **+8,981 / −1,275** |
| Code (`ui/`, `adapters/`, `domain/`, `ports/`, `lib/`, `bin/`, `app.tsx`, `style.css`) | ~4,356 insertions |
| Tests (`tests/`) | ~2,694 insertions, 21 files |
| Tickets/design/mockups | ~1,912 insertions |

Contents: the full five-state bar (REQ-002), selection-first flow + overlay window (REQ-003), recording lifecycle + HUD (REQ-004), and the palette.v1 CSS migration (REQ-005).

It is deployed and running:

- `dotfiles-v3` `aad9fd22` (`PIN-0126`, 2026-11-01 23:09:40) → capture **v0.2.0**
- `~/.local/share/dotfiles/apps/capture/pinned` → `v0.2.0`
- `~/.config/ags-capture` → `~/.local/share/dotfiles/apps/capture/v0.2.0`
- running PID **511294**, started **2026-11-04 10:04**, executing v0.2.0
- deployed tree matches the tag (only `build/`, `.dev/`, caches differ)

So JD's "it works actually good" is the redesign running as the daily driver — not the old app.

---

## 2. Where the record diverges from the artifact

This is the part we need you to fix. All of it is documentation/provisioning, not code.

### 2.1 The tag message describes 2 of 24 commits

```text
v0.2.0 — CSS on palette.v1 roles (REQ-005)
```

### 2.2 The repo changelog has no v0.2.0 entry

`git show v0.2.0:CHANGELOG.md` still starts with:

```markdown
## Unreleased
- Migrate `style.css` from legacy `@color_*` carriers ...
```

There is no `## v0.2.0` section anywhere in history. The redesign — bar shell, selection flow, recording lifecycle, overlay, HUD — is absent from the changelog.

### 2.3 There is no GitHub release

`gh release view v0.2.0 -R RandomGenericUsername/ags-capture-tool` → **release not found**. The tag is the only public artifact.

### 2.4 The composition changelog compares the redesign to itself

`dotfiles-v3` `0.6.21` (2026-11-02) says:

> `ags-capture-tool` `v0.1.0` → `v0.2.0`: ink `@on_surface`, … settings errors `@error`; geometry unchanged (measured 1123×54 at the same position).

The `1123×54` measurement comes from `tickets/REQ-005-theme-roles/ticket.md:170`: *"Both bars measured 1123×54 at (399,1026)"* — where "before" and "after" are **the same branch code**, differing only by `style.css`. It is new-vs-new, not v0.1.0-vs-v0.2.0. The resting new rail is **142×54**; the old app was a centred panel. The sentence reads as "nothing visual changed," which is false at the version level.

### 2.5 The freeze was never lifted

- Freeze declared **2026-10-31 20:54** (`c09af3b`, `0cb87f3`): *"No new code, merges, tags or provisioning."*
- REQ-005 code: **2026-11-01 23:04**; tag: **23:09**; provisioning pin: **23:09:40**.
- No unfreeze record exists. `EPIC-001/ticket.md` still carries the Freeze section and the unfreeze criteria; `tickets/INDEX.md` still says `in-progress (frozen 2026-10-31)`.
- The stated unfreeze condition ("theme/CSG migration settles") was not met at release time: theme-producer shipped `v0.5.1` on **2026-11-04 07:54**, and its `EPIC-003` closed **2026-11-04 10:14**.

### 2.6 The epic shipped with open acceptance

- `REQ-003` unticked: `ticket.md:58` (overlay never captured / FR-10) and `:73` (backend flags additive proof).
- `REQ-004` unticked: `ticket.md:303` (recorded-clip proof for `hidden` vs `always`).
- `EPIC-001` is 2/3 children done; `done-when` requires all three done with checklists ticked.
- Status drift: EPIC frontmatter `status: proposed` vs INDEX `in-progress`; REQ-004 ticket `status: done` vs INDEX `in-progress`.

---

## 3. Runtime signal (what is genuinely good)

- No crash loop. One boot-time anomaly: `capture-CRITICAL: event-bus: hydration of capture.state failed: Gio.IOErrorEnum: Timeout` at 07:58:52, then normal operation after the 10:04 restart.
- Recurring `Gdk-WARNING … gdk_frame_timings_throttling_hint` lines — GTK-internal, not app logic, but worth a glance if it correlates with visible jank.
- The three unmeasured claims remain exactly the ones the tickets flagged: overlay-not-recorded clip, `scale≠1` geometry, HUD-in-clip. On this host (single scale=1 output) only the clip checks are feasible.
- Rollback is available: v0.1.0 is still installed; flipping `pinned` + the config symlink restores it. We are not proposing rollback.

---

## 4. What we need from you

Ordered. Each task has a done-when. Do not rewrite the published tag; correct the record forward.

### T1 — Correct the release record (docs only)

Path A chosen (JD, 2026-11-04): same version, no new tag.

- Add a real `## v0.2.0 — 2026-11-01` section to `ags-capture-tool/CHANGELOG.md` covering **all four** requirements, with a short "known verification limits" subsection (the three items in §2.6/§3).
- Publish the corrected notes as the **`v0.2.0` GitHub Release** (`gh release create v0.2.0 --notes-file …`). The tag message stays as-is because tags are immutable.
- Do **not** cut `v0.2.1`. The code did not change; the deployed pin stays at `v0.2.0`.
- If `gh` auth is unavailable, record it as a blocker — do not silently skip.
- Amend the `dotfiles-v3` `0.6.21` entry: either drop "geometry unchanged" or state precisely what was compared (S1 lane, new code before/after REQ-005), and mention that v0.2.0 also carries the bar redesign.
- In `EPIC-001/ticket.md`, replace the live freeze with a **"Freeze superseded by v0.2.0 (record corrected)"** record that keeps the original decision visible, states who/when released, and links the open debt. Update `tickets/INDEX.md` in the same commit.

**Done when:** `main` has a v0.2.0 changelog section; the `v0.2.0` GitHub release exists (or an explicit blocker is recorded); no `v0.2.1` tag exists; the composition entry no longer claims version-level geometry parity; freeze is marked superseded, not deleted.

### T2 — Close the verification debt

- Produce the 2-second clip with a pending selection: no dim, no outline, no handles in the recording.
- Produce the HUD clip: `recording_hud = hidden` → no HUD; `always` → HUD present.
- Tick the corresponding boxes with evidence paths (clip path, command, timestamp, `hyprctl layers` output if relevant).
- For `scale≠1`: either test on a scaled output or mark it explicitly as an environmental limitation with the reason. Do not tick it untested.

**Done when:** REQ-003 and REQ-004 checklists are fully ticked or the single environmental exception is documented; EPIC-001 closes only if `done-when` genuinely holds.

### T3 — Reconcile ticket state

- Make frontmatter, INDEX line, and reality agree for EPIC-001, REQ-003, REQ-004.
- Keep the "status change + INDEX update in the same commit" rule.
- Remove or archive stale worktree/branch links only after their content is on `main`.

### T4 — Open the refinement backlog

JD has no written list, but says you already have context on the refinements and bug corrections from the refactor. Do a live pass with him: drive the bar, capture each issue as `repro:`, `observed:`, `expected:` (the lifecycle gate rejects repro-less bugs), and file one ticket per behaviour. Do not batch fixes into T1/T2; keep the release-record correction separate.

### T5 — Cleanup (optional, after T1–T3)

- Remove `.worktrees/REQ-00{2,3,4,5}` and their branches once merged.
- Remove the installed `v0.1.0` app directory (JD decision: remove) once v0.2.x is confirmed stable; the `v0.1.0` git tag remains the rollback record.

---

## 5. Guardrails

- **Do not move or re-tag `v0.2.0`.** Immutable annotated tags; a published tag is never rewritten. Add a new commit for the changelog.
- **Do not force-push.** `main == origin/main == 1897607`; the tag is on origin. History is already public.
- **Do not fold behaviour fixes into the record correction.** T1 is docs/provisioning; T4 is bugs.
- Gates before any merge: `make test`, `make conformance`, `make backend`, `make typecheck` (all exit 0 on `1897607`).
- Preserve identity: `capture-window`, `capture-ui`, `app.manifest.json`, and the `capture-overlay` name (never rename it to `capture-window`).
- Palette discipline: semantic roles only; no hex; recording accent stays `@error` via `--rec-accent`.
- If you disagree with any finding, say so with a command and output, not an assertion.

---

## 6. Open questions for JD

1. Do you want the v0.2.0 GitHub release published publicly, or is a repo-only record enough?
2. Is a scaled monitor (scale ≠ 1) available for the geometry check, or do we record it as an environmental limitation?
3. Do you want v0.1.0 kept installed as a rollback point after the record is corrected?
4. For T4: paste the refinement list, or do a live pass with the agent? (The old build is still installed if an old-vs-new differential is needed.)

### JD's answers (fill in before handoff)

- **Q1 — release record:** **A — same version (decided 2026-11-04).** Publish the corrected notes on the existing `v0.2.0` GitHub release page and add the `v0.2.0` changelog section on `main`. No new tag; the tag message stays as-is (immutable).
- **Q2 — scaled monitor:** **A** — temporarily set `eDP-1` to scale `1.25`, run one region pick, restore `1.0`; record clip + commands as evidence.
- **Q3 — keep v0.1.0 installed:** **remove** after the record fix lands.
- **Q4 — refinement intake:** **live pass** — JD has no written list, but says you already have context on the refinements and bug corrections. Drive the list with him, then file the tickets.

**Q1 in plain language.** A git tag is the sealed box that holds the code (`v0.2.0`). The repo `CHANGELOG.md` is the paper list inside the box. A **GitHub Release page** is the public label on the box: a title plus a body of text, shown on the repo's Releases tab. It is not code, and it can be edited without opening or moving the tag.

Today the code box exists and is deployed, but **the label is missing** (no GitHub release) and **the paper list still says "Unreleased"** (no v0.2.0 changelog entry). Two ways to fix that:

- **Path A — same version (decided):** write the full notes and publish them as the `v0.2.0` release page; add the `v0.2.0` changelog section on `main`. Nothing about the code or deployed app changes. The tag message stays as-is because tags are immutable.
- **Path B — new version (rejected):** cut a second tag `v0.2.1` containing only the corrected notes. Not used: the code did not change, so a new version number adds no information.

**Decision: A** (JD, 2026-11-04). Do not cut `v0.2.1`.

**Q2 in plain language.** The capture overlay translates pointer coordinates between GTK and Hyprland. On a display at **scale 1.0** that is trivially correct; on a **scaled display** (`scale 1.25`, `1.5`, …) the selection rectangle could land offset. This host exposes only `eDP-1` at scale 1, so the scaled case has never been measured. Options: (a) temporarily set `eDP-1` to `1.25`, run one region pick, restore scale — about two minutes; or (b) mark it "untested, environmental limitation". **Decision: A.**

**Q4 in plain language.** "Refinements" means the things JD noticed while using the new bar — e.g. "the hover ring lags", "Esc hides the bar when I expected it to clear the selection", "the record chip says X but should say Y". For each: what was clicked, what happened, what was expected. If JD would rather not write them down, the agent does a live click-through and writes them down as they go.

### Refinement intake (verbatim; T4 converts these to bug tickets)

| # | What I did | What happened | What I expected | Severity | Old-vs-new needed? |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

> Raw notes are fine — do not clean them up. The agent will normalize each row into `repro:` / `observed:` / `expected:` and triage it. Leave blank if the live pass is preferred.

---

## 7. How the three of us stay connected

- **Your reply:** append a section at the end of this file titled `## Agent response — <date>` with one line per task: `accepted | rejected (evidence) | blocked (reason)` plus ETA and any command output that changes the picture.
- **Location:** this file lives at `/home/inumaki/.opencode/plan/handoff-capture-v0.2.0.md`. JD and I read it from here.
- **Promotion:** once you take ownership, copy it into `tickets/EPIC-001-capture-bar-redesign/release-handoff-2026-11-04.md` so it lives beside the ticket set, and reference it from EPIC-001. (The sender is in Plan mode and cannot write outside the plan directory.)
- **Cadence:** reply before starting T1, then one update per completed task. If a gate fails, stop and report the failing command rather than working around it.
- **T4 status (2026-11-04):** T4 — pass recorded; C5+C17 tickets filed; deferred list in OPS-005.

---

## Appendix — evidence commands

```sh
# release contents
cd /home/inumaki/Development/dotfiles/ags-capture-tool
git log --oneline v0.1.0..v0.2.0
git diff --stat v0.1.0..v0.2.0
git tag -n99 v0.2.0

# changelog at the tag
git show v0.2.0:CHANGELOG.md | head

# deployment
cat ~/.local/share/dotfiles/apps/capture/pinned
readlink -f ~/.config/ags-capture
ps -o pid,lstart,cmd -p 511294

# composition pin
cd /home/inumaki/Development/dotfiles/dotfiles-v3
git show aad9fd22 --stat
git show aad9fd22 -- CHANGELOG.md

# freeze vs release timeline
cd /home/inumaki/Development/dotfiles/ags-capture-tool
git log --format='%h %ad %s' --date=iso -8
sed -n '40,75p' tickets/EPIC-001-capture-bar-redesign/ticket.md

# open acceptance
grep -n '^- \[ \]' tickets/REQ-003-selection-first-flow/ticket.md
grep -n '^- \[ \]' tickets/REQ-004-recording-lifecycle/ticket.md

# runtime signal
tail -40 ~/.local/state/ags/capture.log
```

## Agent response — 2026-11-04

Owner: the capture-bar refactor agent (this session). I re-ran the §2 evidence before replying; every finding stands, including that the `v0.2.0` tag message was cut by me during the app-role batch with the REQ-005-only text. Accepted as a record defect, not disputed.

- **T1 — accepted.** ETA 60 min. Path A: a real `## v0.2.0 — 2026-11-01` section covering REQ-002..REQ-005 + known verification limits; publish those notes on the existing `v0.2.0` GitHub release; amend `dotfiles-v3` `0.6.21` to remove the version-parity claim; mark the freeze superseded (kept visible) and update INDEX in the same commit. No `v0.2.1`, no tag movement.
- **T2 — accepted.** ETA 90 min. Clip checks are feasible at scale 1. Q2=A: temporarily set `eDP-1` scale 1.25 for one region pick, restore 1.0, and record the clip + commands. Produce the pending-selection clip and both HUD clips (`hidden`, `always`). Caveat: the scale change is visible for a short window; I will do it in one pass and restore immediately.
- **T3 — accepted.** ETA 20 min. Reconcile frontmatter, INDEX line and reality for EPIC-001 / REQ-003 / REQ-004 in the same commits as each status change; close EPIC-001 only if `done-when` genuinely holds.
- **T4 — accepted; needs JD live.** ETA 30–45 min once we start. Drive the bar, capture each item as `repro:` / `observed:` / `expected:`, one ticket per behaviour; no fixes folded into T1/T2.
- **T5 — accepted (optional, after T1–T3).** ETA 15 min. Remove merged REQ-002..REQ-005 worktrees/branches; remove the installed `v0.1.0` app directory (JD decision); keep the `v0.1.0` tag as the rollback record.
- **T1 — done (2026-11-04).** `ags-capture-tool` `6286fc1` (v0.2.0 changelog + release notes) and `152182d` (freeze superseded + INDEX); GitHub release <https://github.com/RandomGenericUsername/ags-capture-tool/releases/tag/v0.2.0>; `dotfiles-v3` `c12d9edc` (0.6.21 correction); `OPS-001` records the closeout. All capture gates and `dotfiles-v3 make gates` exit 0. Tag `v0.2.0` is unchanged at `1897607`, no `v0.2.1`, deployed pin stays `v0.2.0`. T2/T3 remain open.
- **T2 — done (2026-11-04).** Verification-only; no app code, tag, or deployed-pin change (live PID 511294 unchanged). (1) Pending-selection clip: external control `clips/pending-chrome-external.mp4` shows the chrome, while the app's own Region+MP4 commit clip `clips/pending-selection-app-region.mp4` has no dim/outline/handles at 0.05s–7s (`...-2s.mp4`; frames `pending-app-*.png`). (2) HUD: `hidden` → `clips/hud-hidden-screen-2s.mp4` has no capture-bar HUD; `always` → `clips/hud-always-screen-2s.mp4` contains the S4 HUD (`frames/hud-hidden-vs-always-bottom.png`); setting restored to `hidden`. (3) Backend additive: legacy argv + interactive `slurp` path exit 0, and `--geometry`/`--monitor`/`--window` produce 320x200 / 1920x1080 / 1898x1014 (`backend/*.log`). (4) `scale≠1`: `eDP-1` 1 → 1.25 → 1; logical 640x440 pick → `-region 640x440+280+160` → 800x550 clip, content aligned (`clips/scale125-region-pick.mp4`). All under `/tmp/opencode/capture-t2/` (`EVIDENCE.md`); repo record `OPS-002-verification-proof/`. T3 remains open.
- **T3 — done (2026-11-04).** `ags-capture-tool` `ee7aab1` (docs only; no code, tag, or deployed-pin change). `REQ-003` and `REQ-004` are `done` with all acceptance boxes ticked; `EPIC-001` is `done` at `3/3` children because every child acceptance checklist is closed. `tickets/INDEX.md` now says `done` / `3/3 children done`; the stale `frozen` wording is gone while the freeze-superseded record remains intact. T2 evidence is linked from the epic/requirements (`/tmp/opencode/capture-t2/EVIDENCE.md`, `OPS-002-verification-proof/evidence.md`), with the precise caveat that the scale-1.25 probe covered a positive-origin output only and negative-origin scaled geometry is unit-tested only. Merged worktree/branch links for REQ-002..REQ-005 are retired (`worktree none`, `branch main`); directories remain for T5. Ownership is recorded in `OPS-003-reconcile-ticket-state`. Gates: `make test` exit 0 (10/10, 1/1, 297/297; test `tsc` clean), `make conformance` exit 0 (16/16), `make backend` exit 0 (`114 passed`), `make typecheck` exit 0 (`0 errors` in-tree). T4/T5 remain open.
- **T5 — done (2026-11-04).** `ags-capture-tool` `b7250b6` (docs only; no code, tag, deployed-pin or release change). Pre-checks: all four branches merged (`git merge-base --is-ancestor` yes, 0 unmerged commits) and all four worktrees clean; live `pinned` = `v0.2.0`, config → `apps/capture/v0.2.0`, PID 511294 running; `v0.1.0` tag present. Removed `.worktrees/REQ-002..005` with `git worktree remove` (no force, all exit 0) and deleted `ticket/REQ-002-capture-bar-shell` (`e8b443f`), `ticket/REQ-003-selection-first-flow` (`b3c5c13`), `ticket/REQ-004-recording-lifecycle` (`d720c2b`), `ticket/REQ-005-theme-roles` (`1897607`) with `git branch -d` (never `-D`). Removed the installed `v0.1.0` app directory (760K; JD Q3 = remove); kept `v0.2.0`, `pinned`, and tag `v0.1.0`. `git worktree prune` exit 0; `git worktree list` shows only the main checkout. Live after: PID 511294 unchanged, `dotfiles-runtime doctor` clean exit 0 (`21 item(s) checked; watch health: ok`), `ags list` shows `capture`. Record: `OPS-004-cleanup`. T4 remains open.
- **T4 — pass recorded (2026-11-04).** JD's live pass is complete. C5 (minimal region: centre drag resizes instead of moves) and the new C17 (Settings panel has no card background and is unreadable over the window behind) are confirmed → `BUG-002` (medium) and `BUG-001` (high). C1/C6/C16 are not bugs, C9 is accepted, C3 is unconfirmed because the C17 defect interrupted it, and C2/C4/C7/C8/C10–C15 are deferred with plain-language reasons. Docs-only: no code, tag, deployed-pin or runtime change. Deferred list and T2 toast residue: `tickets/OPS-005-t4-refinement-intake/ticket.md`.

Evidence that changes the picture:
- `gh auth status` → authenticated as `RandomGenericUsername` with `repo` scope; `gh release view v0.2.0` → `release not found`. T1's release step is **not blocked**.
- Live: `apps/capture/pinned` = `v0.2.0`; `~/.config/ags-capture` resolves to `apps/capture/v0.2.0`; PID 511294 running.
- Repo is clean at `1897607` = `origin/main`; no force-push needed. Worktrees REQ-002..005 present as listed.

### v0.2.1 verification — 2026-11-04

Deployed `v0.2.1` live retest (pin `v0.2.1`; `~/.config/ags-capture` → `apps/capture/v0.2.1`; capture PID 902796). Docs/evidence only; no app code, tag, release or pin change.

- **BUG-001 — done.** Settings card is opaque over a text-heavy kitty + Chrome window. At the card's left padding (`x=618`) the v0.2.0 before shot has std 0.286/0.244 (text bleed-through); v0.2.1 has std 0 (uniform `@surface`). `after-settings-over-text-v021.png` vs `before-settings-over-text-v020.png`.
- **BUG-002 — done.** A `15×15` region centre-dragged `(407,407)` → `(507,507)` kept the `15×15` badge and translated its handle bbox exactly **+100,+100** (279 pixels before/after). A normal `200×120` region still moved from the centre at the same size, and a bottom-right corner drag resized it to `250×150`.
- **C3 — not reproduced; dismissed with evidence.** Two region recordings including the bar: `recording_2026-11-04_12-42-02.mp4` (clicked Record) and `recording_2026-11-04_12-45-32.mp4` (pointer parked inside the live 200×200 hit area at `860,880`, started with Enter). Frames at 0.05/0.2/0.5/1 s show **no capture-bar HUD**; the C3 first-frame condition is not met, so no ticket was filed. Caveat: live pointer re-entry also did not reveal the hover chrome in this automated run; that positive hover path is recorded as unverified/automation-limited, not as a C3 confirmation.
- **Live after:** capture running `v0.2.1`; `recording_hud` restored to `hidden`; wallpaper untouched (`current.json` mtime 12:30:01, sha256 unchanged); `dotfiles-runtime doctor` clean (21 items). Evidence: `/tmp/opencode/capture-verify-v021/EVIDENCE.md`. Tickets/INDEX updated: BUG-001 and BUG-002 `done`; OPS-005 records the C3 retest.

### v0.2.1 JD sign-off and hover-HUD probe — 2026-11-04

Docs only; no app code, tag, release or pin change.

- **BUG-001 — JD confirmed good/fixed** on the live `v0.2.1` instance. Stays `done`.
- **BUG-002 — JD confirmed good at ~30 px** on the live `v0.2.1` instance; accepted at ≥30 px, minimal-size drag not pursued. Stays `done`; no min-size constraint or code change.
- **Hover HUD (C3) — expected behaviour, not unreachable; no BUG-003 filed.** JD reported "the bar disappears when capturing, so hover never shows." That disappearance is the D9 `hover` design: the S4 window is mapped with its chrome at opacity 0 until pointer entry. Source: `domain/recording-hud.ts:95-110`; `ui/classic/ClassicWindow.tsx:250-272,681-698`. Live probe on `v0.2.1` (synthetic `capture.state=recording`; no real recording): `hyprctl layers` showed `xywh: 922 1042 76 38` for the hover surface, and moving the pointer into it revealed the dot + `00:03` HUD (`/tmp/opencode/hover-probe/s4-hover-enter.png`). Likely source of the impression: the S4 hit area is only the HUD row (76×38, bottom centre), while the S1 bar and Record CTA are much wider, so returning to the old button position can miss it.
- **Decision for JD:** accept the invisible/small hover target as-is, add a faint affordance (e.g. a persistent dot/timer), or rename the option so "hidden until hover" is explicit. No code is changed here.
- **State after probe:** hub `capture.state` restored to `idle`, bar back to S0, pointer returned; `recording_hud` left at `hover` (JD's setting). Evidence: `/tmp/opencode/hover-probe/`.
