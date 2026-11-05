# Agent brief — EPIC-002 capture dropdowns

**Read in this order, every time:**

1. `capture-dropdowns-epic-plan.md` (this directory) — the authoritative plan.
2. `mockups/capture-tool-dropdowns.html` (this ticket) — the normative mockup. The
   `<script type="application/json" id="design-contract">` block is the
   machine-readable vocabulary.
3. The repo's `AGENTS.md` and the ticket you were assigned.
4. The current source files named in your ticket.

**Your boundary**

- Implement **only** the ticket you were assigned. Do not start the next child.
- Do not edit the mockup, its `design-contract` block, the plan, or another
  ticket.
- Do not change `app.manifest.json`, the window names `capture-window` /
  `capture-overlay`, the launcher `capture-ui`, or the identity tuple.
- Do not add a second request→argv translator, a second settings/UI-state
  source, or a second app list.
- Do not add literal colours to `style.css`; use palette tokens only.
- Do not delete legacy settings JSON fields; mark them deprecated and keep them
  parseable.
- Do not migrate cursor into `capture-ui.json`; it stays in `config.json` in
  this epic.
- Do not invent a monitor service or a new repo. The service is
  `dotfiles-runtime monitors list --format json`.

**Stop and ask the orchestrator if**

- a label, description, option value, default, field order, monitor shape or
  settings row is not in the mockup contract;
- the mockup and the plan disagree;
- a gate fails for a reason outside your ticket;
- you need a new dependency, repo, tag or `contracts`/`ags-platform` change;
- the measured lane width exceeds the ticket ceiling;
- a live state cannot be reproduced with the available hardware.

Do not "fix" the mockup to match your implementation. The mockup is the
reference; the implementation follows it.

**Definition of done for every ticket**

- Code + tests + CSS in the ticket's scope.
- `make test` and the other gates named in the ticket pass; paste the exact
  commands and results.
- The parity test (`REQ-013`) is green, or your ticket records why it is not
  applicable yet.
- Live evidence in `/tmp/opencode/capture-dropdowns/<ticket>/` for every state
  you changed; list the paths in the ticket.
- Ticket acceptance boxes ticked; `tickets/INDEX.md` updated in the same commit.
- No unrelated files in the diff.

**Sequence (orchestrator-owned)**

```text
REQ-008 (runtime service) ──┐
REQ-009 (primitive + shot) ─┼─> REQ-010 (recording) ─> REQ-012 (settings)
                            └─> REQ-011 (monitor dropdown) ─┘
                                                       ├─> REQ-013 (parity)
                                                       └─> OPS-008 (historical banners/docs)
                                                              └─> OPS-007 (release/pins)
```

`REQ-009` and `REQ-008` may run in parallel. `REQ-011` waits for both.
`REQ-013` and `OPS-008` wait for all UI children. `OPS-007` waits for
everything.

**What to return to the orchestrator**

- Ticket id, branch, worktree, commit SHA.
- Gate commands + exit codes + key output.
- Evidence paths.
- Any deviation, open question, or risk.
- Confirmation that the mockup/contract was not edited.
