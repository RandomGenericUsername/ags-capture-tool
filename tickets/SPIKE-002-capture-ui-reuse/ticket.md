---
id: SPIKE-002
title: "One recording cluster: capture-owned component vs a capture-drawn window"
kind: spike
status: reported
lane: bmad-advisory
timebox: "2h"
questions:
  - "Which parts of the live recording UI are actually shared between ags-bar and ags-capture-tool, and which are host-specific?"
  - "Can the capture tool export one recording cluster (dot, timer, popup, pause/stop) that ags-bar hosts inline with a given size/position, without IPC and without a second event reader?"
  - "If the capture instance must draw the cluster instead, what contract and window mechanics would that require, and what breaks?"
  - "What is the smallest correct path, and what single decision does JD have to make?"
answered:
  - "Both apps implement the same UI surface independently. The bar's copy is 218 LOC with zero tests; the capture copy is the tested one (729 LOC across three suites). The shared part is the cluster + popover + recording indicator state, not the window/hover lifecycle."
  - "Yes. Both surfaces already use the same primitives: a Gtk.Popover anchored to a status button, driven by the platform event bus and the same icon group. A shared component can be hosted inline by either app; no IPC and no second event reader is needed."
  - "A capture-drawn window needs an app-to-app channel that does not exist today. The contract names the hub as the sole emitter, known topics are generated from `contracts`, and a new topic touches contracts + runtime + platform + both apps. The bar would also lose its indicator whenever the capture instance is not running."
  - "Recommend option A: move the cluster into `ags-platform` as a capture-owned UI module and delete the bar's copy. Decision: approve A (shared, inline) and reject B (IPC window)."
open:
  - "No live probe was run for a shared component imported from `ags-platform` under the bar or capture bundle. The import path and CSS-string delivery are reasoned from the current packaging, not executed."
  - "The exact bar-slot width/height was not measured; only the capture HUD sizes are measured (76×38 compact, 243×46 full). The API keeps width/height optional so natural sizing stays the default."
  - "Whether Gtk.Popover outside-click dismissal behaves identically when the popover's host is a tiny cluster-sized layer surface (option B) was not probed; this is a B risk, not an A risk."
links:
  openspec: none
  bmad: none
worktree: none
branch: main
---

# One recording cluster: capture-owned component vs a capture-drawn window

> **Status: reported 2026-11-04.** Read-only audit. No app code, tag, release or
> deployed-pin change. This ticket answers JD's request: the capture tool should
> own the recording cluster/popup as the single component, and the top bar
> should only draw that cluster at a given size and position instead of
> maintaining its own copy.

## Questions

1. What exactly is duplicated between the bar's recording widget and the capture
   tool's S4 HUD, and which parts are genuinely host-specific?
2. Can one component be imported and hosted inline by both apps without IPC?
3. What would a capture-drawn window over IPC require, and what does it break?
4. Which option is the smallest correct path, and what is the one decision JD
   must make?

## Findings

### 1. The bar owns a complete second implementation

`ags-bar/bar/widgets/recording.tsx:51-218` is a self-contained recording UI:

- Local state + elapsed interpolation + hub subscription + restart reset:
  `ags-bar/bar/widgets/recording.tsx:52-101`. It subscribes to `capture.state`
  itself (`:79-88`), resets on hub restart (`:93`), and runs its own 1 s GLib
  timer (`:95-101`).
- Pause/Resume/Stop actions through the injected `ctx.hub.control`
  (`:103-110`), with the pause/resume decision duplicated inline at `:108-110`.
- The cluster root is the widget shell itself: `class: "rec-cluster"` and the
  paused state class are declared at `:129-130`; the shared `RichWidget`
  renderer wraps the content in that shell
  (`ags-bar/kit/widget.tsx:177-207`, class composition at `:75-79`).
- Dot + timer status button: `:133-156`.
- Full-mode icon buttons: `:157-179`; icon paths resolve from the
  `capture-tool` icon group (`:17-19`).
- The popover is instantiated **inside the widget** at `:180-214`, anchored to
  the `rec-status` button (`:146-150`), with a status row (`:182-185`) and two
  actions (`:188-212`). It is a plain `Gtk.Popover`, not `kit/popup-host.tsx`;
  the bar's other popups use `PopupHost`, but the recording surface never does.
- Placement is data: `bar/layout.default.ts:31` puts `recording` in the `end`
  section; the manifest declares it single-instance with no params
  (`bar/bar-manifest.ts:68`).
- CSS: `ags-bar/style.css:124-246` (18 rule blocks, 123 lines) including its
  own `@keyframes rec-pulse` (`:144-154`).

It has **zero tests**: no file under `ags-bar/tests/` mentions the recording
widget (grep returns nothing). The monorepo copy
`ags-apps/bar/bar/widgets/recording.tsx` is byte-identical (218 lines,
`diff` exit 0), so the same code exists three times physically
(`ags-bar`, `ags-apps`, and the distinct capture implementation).

### 2. The capture tool owns the tested implementation

The S4 HUD in `ags-capture-tool/ui/classic/ClassicWindow.tsx`:

- Widget handles and state variables: `:129-153`, `:419-432`.
- Compact/full placement: `:480-485`; the pure rule is
  `domain/recording-hud.ts:151-153`.
- Window mapping / hover / on-demand presentation: `:487-519`.
- Projection onto widgets (dot paused class, Pause↔Resume label, job-id
  sensitivity): `:521-536`.
- S4 entry/exit: `:538-578`.
- Snapshot handling + late-stop handling: `:580-615`.
- Pause/stop: `:617-620`, `:644-654`.
- BUG-003 press hold: `:622-642`.
- Keyboard suppression in S4: `:817-820`.
- Subscriptions + 1 s ticker + destroy cleanup: `:928-969`.
- Map/unmap on-demand presentation: `:1001-1017`.
- HUD + popover JSX: `:1216-1332` (popover at `:1286-1331`).
- Pure state machine: `domain/recording-hud.ts:25-56` (state),
  `:97-115` (visibility), `:118-123` (MM:SS), `:132-141` (interpolation),
  `:151-163` (placement/labels), `:186-225` (ordering/idempotency reducer),
  `:228-236` (local stop).
- CSS: `ags-capture-tool/style.css:280-353` (11 rule blocks, 74 lines) plus the
  shared `.bar-pill` vocabulary it borrows (`:210-229`, 20 lines); its own
  `@keyframes rec-pulse` at `:313-323`.
- Tests: `tests/ts/recording-hud.test.ts` (296 lines),
  `tests/ts/recording-lifecycle.test.ts` (306), `tests/ts/capture-state-feed.test.ts`
  (127) — 729 lines, including a "no hex colour in style.css" assertion
  (`recording-lifecycle.test.ts:57-66`).

### 3. Feature comparison

| Behaviour | ags-bar | ags-capture-tool | Same? |
|---|---|---|---|
| Pulse | Box-shadow ring, 1.6 s, `#e0605f` literal (`style.css:136-154`) | Opacity 0.35↔1, 1.6 s, `var(--rec-accent)` (`style.css:300-323`) | **No** — same keyframe name `rec-pulse`, different body |
| Paused dot | `@tertiary`, animation+shadow off (`style.css:156-160`) | Stays red, `opacity: .45`, animation off (`style.css:308-311`) | **No** |
| Timer format | `MM:SS`, minutes grow past 99 (`recording.tsx:11-15`) | `MM:SS`, same rule (`recording-hud.ts:118-123`) | Yes |
| Timer typography | 13 px bold, min-width 46 (`style.css:171-178`) | 12 px bold (`style.css:325-329`) | **No** (density) |
| Local interpolation | Own 1 s timer, only while `recording` (`recording.tsx:95-101`) | Pure `elapsedAt` + window 1 s ticker (`recording-hud.ts:132-136`, `ClassicWindow.tsx:940-945`) | Same rule, two implementations |
| Ordering / replay safety | None (last push wins; no ended-job or monotonic guard) | Full reducer (`recording-hud.ts:186-225`) | **No** |
| Stop before job id | Drops the action (`recording.tsx:104`) | Defers it until the first snapshot names the job (`ClassicWindow.tsx:592-598`, `:649-651`) | **No** |
| Popup trigger | Only when compact (`recording.tsx:146-150`) | Only when compact (`ClassicWindow.tsx:1229-1231`) | Yes |
| Popup status row | Dot + "Recording"/"Recording paused" (`recording.tsx:116`, `:182-185`) | Dot + static "Recording" (`ClassicWindow.tsx:1303-1310`) | **No** — capture never says paused |
| Popup actions | Icon + label, Pause/Stop (`recording.tsx:188-211`) | Text labels "Pause" / "⏹ Stop" (`ClassicWindow.tsx:1311-1329`) | **No** |
| In-row actions | Icon-only buttons (`recording.tsx:157-179`) | Text pills `.hud-toggle` / `.hud-stop` (`ClassicWindow.tsx:1263-1284`) | **No** |
| Popover placement | Gtk native anchor, no custom geometry (`recording.tsx:180`) | Gtk popover inside the layer window; BUG-003 reads `Gdk.Popup` position (`ClassicWindow.tsx:271-298`) | Host-specific |
| Press guard | None needed (bar is always mapped) | 200 ms leave grace + press hold (`ClassicWindow.tsx:97-101`, `:622-642`) | Host-specific |
| Keyboard / dismiss | Popover native Escape + outside click (`recording.tsx:59-61`) | S4 swallows every key; popover closed when chrome hides (`ClassicWindow.tsx:817-820`, `:507`) | Different by design |
| Compact source | `Preferences` port, `capture-tool.bar_compact_controls` (`recording.tsx:55`) | Same setting read at S4 entry (`ClassicWindow.tsx:553`, `domain/settings.ts:38,68`) | Yes |
| Icons | `registry.resolve("capture-tool", "pause"/"play"/"stop")` (`recording.tsx:17-19`) | Icons exist in the same manifest but the HUD uses text | **No** — asset already shared, usage differs |
| Theme | `@surface`/`@on_surface`/`@tertiary` + one hex literal (`style.css:124-160`) | `@surface`/`@on_surface`, `--rec-accent: @error`, zero hex (`style.css:33`, `:304`, `:340`) | **No** |
| Measured size | Not measured; natural size | 76×38 compact, 243×46 full (`tickets/SPIKE-001-hover-region/ticket.md:68-69`) | Host-specific |

The important split: **the cluster, the popover and the indicator state are
shared; the window lifecycle (map/unmap, hover poll, popup hit rect, press
guard) is capture-only.** The bar is always mapped and needs none of it.

### 4. Duplication count

Counted with `wc -l` and the line ranges above; comments included, because they
carry the behavioural rationale.

| Artifact | ags-bar | ags-capture-tool | Shareable | Host-only |
|---|---|---|---|---|
| Cluster + popover JSX | 86 (`recording.tsx:131-216`) | 117 (`ClassicWindow.tsx:1216-1332`) | ~150 net | ~50 (shell/density) |
| Indicator state + timer + actions | 72 (`recording.tsx:52-123`) | 236 pure + ~80 binding | ~300 | ~60 (window/stop-pending policy) |
| Popup open/close + compact rules | 12 (`:66-68`, `:146-150`) | 20 (`:480-485`, `:1229-1231`) | ~25 | ~7 |
| CSS | 123 (`style.css:124-246`) | 94 (`style.css:280-353` + `.bar-pill`) | ~110 canonical | ~30 density |
| Tests | 0 | 729 (3 suites) | all 729 move/retarget | window tests stay |
| Physical copies of the bar widget | 2 (`ags-bar`, `ags-apps` identical) | 1 (different) | — | — |

**Rough total: ~600 semantically unique LOC + ~120 CSS lines implemented twice,
plus a third physical copy of the bar widget.** The capture copy is the one with
tests and the more correct state machine.

### 5. Integration constraints (these decide the options)

- **No app imports another app.** Both repos state it:
  `ags-bar/AGENTS.md` §2 ("Depend on `ags-platform` ... never on a sibling app
  repo") and `ags-capture-tool/AGENTS.md` §2 ("No app imports another app.
  `ags-platform` is the runtime dependency").
- **There is no app-to-app channel today.** `contracts/event-contract.json:2-7`
  names the hub as the sole emitter; `capture.state` carries only
  `state` + `elapsed_seconds` (`:61-66`), and the UI position/size is not in the
  contract. Known topics are generated into the runtime
  (`dotfiles-runtime/src/runtime/domain/hub.py:24,61,329,361`) with a per-topic
  schema and rate budget (`dotfiles-runtime/src/runtime/adapters/emit_validation.py:91-98`).
  A new bar→capture topic is a contracts + runtime + platform change.
- **Packaging expects one shared unit.** `ags-platform` is installed once and
  located by a bare specifier (`dotfiles-provision/ansible/roles/ags_platform/tasks/main.yml:1-10`).
  The apps are currently on different pins: `ags-bar/.dev/ags-platform/v0.3.0`
  and `ags-capture-tool/.dev/ags-platform/v0.4.0`. A shared component forces one
  pin for both.
- **The platform already declares UI surfaces in its contract** —
  `ags-platform/AGENTS.md` §2 lists `Surface{Spec,Registry} + PopupHost` and
  `BarContext` — but the live platform has no GTK/JSX module (only ports and
  adapters). A capture-owned UI module is an addition to a declared scope, not a
  new category.
- **Icons are already shared.** The `capture-tool` group in
  `ags-platform/icons.json` (pause at `:292`, play at `:297`, stop at `:302`)
  is byte-identical to the bar's copy (`diff` exit 0), so a shared component can
  use icons in both apps without a manifest change.

## Options

### Option A — one capture-owned component, hosted inline (no IPC)

The capture repo owns one module: cluster root + dot + timer + popover +
Pause/Resume/Stop + the pure indicator state. The bar imports it and renders it
in its existing widget slot. The bar passes `width`/`height`/anchor and the
compact accessor; it deletes its own state subscription, timer, popover and
CSS. The "popup" is part of the component (a Gtk.Popover anchored to the status
button), so there is no separate bar popup to host.

Two packaging sub-options:

- **A1 (recommended): move the module to `ags-platform/ui/recording-cluster/`,
  owned by the capture tool.** One installed unit, one pin, no new provisioning
  role, and it matches the platform's declared UI scope. Cost: platform gains a
  GTK/JSX module and must keep it out of its stock-Node test path.
- **A2: export it from `ags-capture-tool` and make the bar depend on that
  package.** Smaller edit inside the capture repo, but it breaks the "no app
  imports another app" rule, adds a second app dependency to the bar, and needs
  a new installed unit/pin. It is not smaller once the rule is enforced.

| Pros | Cons | Effort |
|---|---|---|
| No IPC, no contract change, no new topic. | Both apps must move to one `ags-platform` pin. | 3–4 days total |
| Bar keeps working when the capture instance is down (build-time import, runtime data still from the hub). | Platform gains GTK/JSX; its pure test gate must exclude the UI module. | |
| Bar keeps native popover dismissal (Escape/outside click) and its always-mapped window. | CSS delivery needs one decision (recommended: the module exports a CSS string appended to each app's `css`). | |
| Monitor, scale, anchor, stacking come from the host for free. | Capture must expose the popover/root handles to keep BUG-003 and the hover rect working. | |
| One state machine, one test suite; the bar's zero-test copy disappears. | Visible density/icon changes in the capture HUD (unify on icons + labels). | |

### Option B — capture draws the cluster in its own layer window over IPC

The bar publishes show/hide/size/position; the capture instance creates a
cluster-sized `Astal.Window` (OVERLAY, IGNORE, keymode NONE) at those
coordinates and owns the component and its popover.

| Pros | Cons | Effort |
|---|---|---|
| The cluster is literally one surface, owned and drawn by capture. | No app→app channel exists; adding a topic means contracts + generated bindings + runtime schema/rate + platform constant + both apps. | 5–8 days |
| The bar's layout stays free of capture UI. | Bar shows nothing if the capture instance is stopped/crashed; today the bar's indicator is independent. | |
| Capture reuses its own hover/press machinery directly. | Position sync: the bar's cluster moves with layout, workspace and monitor changes; the bar must publish every change, and scale/multi-monitor coordinates must match. | |
| | Stacking: the capture OVERLAY window sits above the bar's EXCLUSIVE window—acceptable visually, but the popover's outside-click/focus behaviour on a tiny layer surface is unprobed. | |
| | Click-through when hidden: a hidden cluster must unmap; a mapped-but-empty surface would swallow clicks. | |
| | Two processes to debug for one 76×38 surface; the bar still needs a fallback for "capture not running". | |

## Recommendation

**Option A, sub-option A1: one capture-owned component in `ags-platform`,
hosted inline by both apps.** It is the only option that removes the duplicate
without inventing a cross-process UI protocol. It keeps the bar's indicator
working with the capture app stopped, keeps native popover dismissal, and
inherits monitor/scale from each host. Option B is strictly larger: the channel
it needs does not exist, and it makes the bar depend on a running capture
instance for a control the bar already renders correctly.

The bar's `recording.tsx` shrinks from 218 lines to a ~20-line adapter; the
capture window keeps only its hover/window lifecycle and delegates the surface.

## API sketch

```ts
// ags-platform/ui/recording-cluster/state.ts   (capture-owned, pure)
export interface RecordingClusterModel {
  phase: "idle" | "recording" | "paused"
  elapsedSeconds: number
  syncedAtMs: number
  jobId: string | null
}

export interface RecordingClusterState {
  readonly model: ReadAccessor<RecordingClusterModel>
  readonly live: ReadAccessor<boolean>
  toggle(): void          // pause when recording, resume when paused
  stop(): void            // defers until jobId exists, like the capture HUD
  dispose(): void
}

export function createRecordingClusterState(
  feed: CaptureStateFeed,          // platform event bus binding
): RecordingClusterState

export function formatElapsed(seconds: number): string   // MM:SS
export function elapsedAt(m: RecordingClusterModel, nowMs: number): number
```

```ts
// ags-platform/ui/recording-cluster/index.tsx  (capture-owned, GTK)
export interface RecordingClusterProps {
  state: RecordingClusterState
  /** false = controls in the cluster; true = controls in the popover. */
  compact: ReadAccessor<boolean>

  /** Host slot, both optional: natural size when omitted. */
  width?: number
  height?: number

  /** Where the popover opens relative to the status button. */
  popupAnchor?: "auto" | "up" | "down"

  /** CSS density only; behaviour is identical. */
  density?: "bar" | "capture"

  /** Capture-only live-palette hook; the bar ignores it. */
  onPopupOpenChanged?: (open: boolean) => void
  registerRefresh?: (refresh: () => void) => () => void

  /** Labels are overridable, not forked. */
  labels?: {
    recording?: string        // default "Recording"
    paused?: string           // default "Recording paused"
    pause?: string            // default "Pause"
    resume?: string           // default "Resume"
    stop?: string             // default "Stop"
  }
}

export interface RecordingClusterHandle {
  /** The cluster root. Hosts place it; they never restyle its internals. */
  root: JSX.Element
  /** The status button the popover anchors to (capture hover rect). */
  anchor: Gtk.Widget
  /** The popover (capture reads its Gdk.Popup position for BUG-003). */
  popup: Gtk.Popover
  openPopup(): void
  closePopup(): void
  refreshIcons(): void
}

export function createRecordingCluster(
  props: RecordingClusterProps,
): RecordingClusterHandle

/** Appended to each host's `css` string; no deployed CSS file. */
export const RECORDING_CLUSTER_CSS: string
```

Bar adapter (replaces `recording.tsx:51-218`):

```ts
export function createRecordingWidget(): RichWidgetSpec<RecordingState> {
  const state = createRecordingClusterState(captureFeed())
  const compact = preferences.get("capture-tool", "bar_compact_controls", false)
  const cluster = createRecordingCluster({ state, compact, density: "bar" })

  return {
    id: "recording",
    read: () => state.model().phase,
    visible: (phase) => phase !== "idle",
    stateClass: (phase) => (phase === "paused" ? "paused" : null),
    content: () => cluster.root,     // the slot supplies size/position
  }
}
```

Capture host (keeps its window lifecycle, delegates the surface):

```ts
const cluster = createRecordingCluster({
  state: recordingState,            // same helper, created once per window
  compact: () => hudCompact,
  density: "capture",
  onPopupOpenChanged: (open) => { if (open) presentBar() },
  registerRefresh: (refresh) => appearanceRegistry.register({
    clearCaches: () => {}, rebuildIcons: refresh, refreshWindow: syncWindowSize,
  }),
})

// S4 row renders cluster.root; the old hud-status/hud-actions/hud-popup JSX goes.
// applyHudVisibility:  if (!showChrome) cluster.closePopup()
// BUG-003:             watchHudPress(cluster.root); watchHudPress(cluster.popup)
// popupHoverRect:      cluster.popup.get_native()?.get_surface()
```

The component owns the 1 s interpolation timer, the compact effect that closes
the popover, the paused dot class, the label flips and the job-id sensitivity.
Hosts keep only: when to show the surface, where to place it, and what to do
after a stop.

## Effort

| Step | Effort |
|---|---|
| Extract component + CSS string + state helper from capture; retarget its tests | 0.5–1 d |
| Add `ags-platform/ui/recording-cluster` export + exclude it from the stock-Node gate + bump to one pin | 0.5–1 d |
| Bar cutover (delete the copy, add the adapter, add a source-level test) | 0.5 d |
| Capture cutover (S4 row, popover handle, BUG-003, hover rect, live refresh) | 1 d |
| Live probe: bar + capture, top/bottom, compact/full, pause/resume/stop, palette refresh | 0.5 d |
| **Total (Option A)** | **3–4 d across platform, capture, bar, provision** |
| Option B (contracts + runtime + platform + capture window + bar publisher + probes) | 5–8 d across five repos plus provision pins |

A follow-up is needed either way to retire the identical
`ags-apps/bar/bar/widgets/recording.tsx` copy; the ticket does not change it.

## Exact decision for JD

**Approve option A (A1): one recording cluster + popover + indicator state,
owned by the capture tool and shipped as an `ags-platform` UI module; the bar
hosts that component inline and passes its slot size/position, and the bar's own
`recording.tsx` state/timer/popover/CSS copy is deleted. No IPC, no new event
topic.**

If you reject A, the fallback is **B**, and it requires approving a new
bar→capture contract topic plus the capture instance being required for the bar
indicator. That is a larger, riskier project for the same pixels.

## Open / not verified

- The `ags-platform` UI import has not been bundled from either app
  (`ags bundle app.tsx ...` was not run with the new path). Verify with a
  30-minute spike before scheduling the build.
- The CSS-string delivery is reasoned from `app.start({ css: style })`
  (`ags-bar/app.tsx:39`, `ags-capture-tool/app.tsx:78`); a `.css` file exported
  from the unit is the alternative if the string approach is rejected.
- The bar-slot size/position is not measured; only capture's 76×38 / 243×46 is
  measured (`tickets/SPIKE-001-hover-region/ticket.md:68-69`). Keep both props
  optional so GTK natural sizing remains the default.
- Unifying on icons changes the capture HUD visually (today it uses text pills
  and "⏹ Stop"). That is a design acceptance in A, not a runtime risk.
- Option B's popover focus/outside-click on a tiny layer surface, and its
  multi-monitor/scale coordinate equality, were not probed. They are the main
  reasons B is not recommended.

## Evidence commands

```sh
cd /home/inumaki/Development/dotfiles
wc -l ags-bar/bar/widgets/recording.tsx ags-apps/bar/bar/widgets/recording.tsx
diff -q ags-bar/bar/widgets/recording.tsx ags-apps/bar/bar/widgets/recording.tsx
grep -n "rec-cluster\|rec-popup\|rec-pulse" ags-bar/style.css
grep -n "capture-bar hud\|hud-dot\|hud-timer\|hud-popup\|hud-actions" ags-capture-tool/style.css
sed -n '51,218p' ags-bar/bar/widgets/recording.tsx
sed -n '475,654p;1216,1332p' ags-capture-tool/ui/classic/ClassicWindow.tsx
sed -n '186,236p' ags-capture-tool/domain/recording-hud.ts
wc -l ags-capture-tool/tests/ts/recording-hud.test.ts \
      ags-capture-tool/tests/ts/recording-lifecycle.test.ts \
      ags-capture-tool/tests/ts/capture-state-feed.test.ts
grep -rn "recording" ags-bar/tests/ts ags-bar/tests/validation   # no matches
grep -n '"pause"\|"play"\|"stop"' ags-platform/icons.json
diff -q ags-platform/icons.json ags-bar/icons.json
sed -n '61,67p' contracts/event-contract.json
```

- Spike time used: ~1.5 h of the 2 h box (read-only source, CSS, tests,
  contract and packaging review).
- No app code, tags, releases or deployed pins changed. No live probe run.
