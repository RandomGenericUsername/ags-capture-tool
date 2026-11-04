---
id: SPIKE-003
title: "Capture-drawn recording cluster over the AGS request channel (option B)"
kind: spike
status: reported
lane: bmad-advisory
timebox: "2h"
decision: "B — the capture instance draws the cluster; the bar only sends show/update/hide"
supersedes: "SPIKE-002 option A recommendation (JD chose B, 2026-11-04)"
questions:
  - "Which existing transport should carry show/update/hide from ags-bar to the capture instance, with no new runtime event topic?"
  - "What exact versioned payload, ownership split and failure behavior does the capture-drawn cluster need?"
  - "What window/layer/anchor/input/focus rules must the capture instance own, and what must be probed before build?"
  - "What is the migration, test and rollback plan that deletes the bar's duplicate cluster without keeping a second fallback?"
answered:
  - "Use `ags request capture-cluster '<json>' -i capture`. It is the existing AGS request transport, the capture app already answers `palette-refresh` there, and a missing instance fails loudly with exit 1. No new contract topic and no runtime change."
  - "A versioned v1 JSON payload carries command, seq, compact, the bar-owned monitor-local anchor rect and optional observed state/labels. The capture instance owns the rendered state, timer, labels, popover and actions."
  - "The capture instance creates one small OVERLAY/IGNORE/Keymode.NONE layer window per reporting monitor at the bar-provided rect, plus the existing popover pattern; the bar keeps only a request client, visibility and a reserved slot."
  - "Land in two phases: prove the capture-drawn path behind a local toggle, then delete the bar's state/timer/popover/CSS and add source guards. Rollback is a plain revert; no data, runtime or topic migration."
open:
  - "No live probe was run. `Gtk.Popover` on a 76×38 layer surface (clipping, outside-click, Escape) is the largest unknown; the fallback is the bar's proven separate popover window + full-screen catcher (`ags-bar/kit/popup-host.tsx:46-173`)."
  - "The exact bar slot size was not measured. The capture HUD sizes are 76×38 compact and 243×46 full (`tickets/SPIKE-001-hover-region/ticket.md:68-69`); the bar must confirm or replace those constants on the live bar."
  - "Mixed-scale and negative-origin multi-monitor equality was not live-probed. Both sides use GDK logical coordinates, but the bar-slot→monitor-origin conversion and layer-shell margins need a 1x/2x probe."
links:
  openspec: none
  bmad: none
  spike: SPIKE-002
worktree: .worktrees/SPIKE-003/
branch: ticket/SPIKE-003-capture-cluster-ipc
---

# Capture-drawn recording cluster over the AGS request channel (option B)

> **Status: reported 2026-11-04.** Design/evidence only. No app code, tag,
> release or deployed-pin change. This is the B-specific follow-up to
> [SPIKE-002](../SPIKE-002-capture-ui-reuse/ticket.md); JD chose B over the
> audit's A recommendation because the capture tool should own the runtime
> window/rendering and the bar should only ask it to draw the cluster at a given
> size/position.
>
> **Implementing session starts here:** the standalone handoff is
> `~/.opencode/plan/handoff-capture-cluster-ipc.md`. The ticket is the design and
> evidence; the handoff is the step-by-step build order.

## Context and baseline

SPIKE-002 established the duplication and the integration constraints. The
relevant facts are carried forward, not re-derived:

- The bar owns a complete second cluster: state + elapsed interpolation + hub
  subscription + restart reset (`ags-bar/bar/widgets/recording.tsx:52-101`),
  Pause/Stop through `ctx.hub.control` (`:103-110`), dot/timer (`:133-156`),
  full-mode controls (`:157-179`), an in-widget `Gtk.Popover`
  (`:180-214`), and 123 CSS lines (`ags-bar/style.css:124-246`, including its
  own `@keyframes rec-pulse` at `:144-154`).
- The capture tool owns the tested HUD: pure state machine and rules in
  `domain/recording-hud.ts` (state `:25-56`, visibility `:97-115`, timer
  `:118-123`, interpolation `:132-141`, placement/labels `:151-163`, reducer
  `:186-225`), S4 JSX at
  `ui/classic/ClassicWindow.tsx:1216-1332` (popover `:1286-1331`), CSS at
  `style.css:280-353`, and 729 lines of tests across
  `tests/ts/recording-hud.test.ts`,
  `tests/ts/recording-lifecycle.test.ts` and
  `tests/ts/capture-state-feed.test.ts`.
- Both apps already depend on `ags-platform`; the bar is restart mode and the
  capture tool is live mode (`ags-bar/app.manifest.json`,
  `ags-capture-tool/app.manifest.json`). No app imports another app
  (`ags-capture-tool/AGENTS.md` §2).
- The hub is the sole event emitter, and `capture.state` carries only
  `state` + `elapsed_seconds` (`contracts/event-contract.json:4,61-66`). There
  is no app→app event channel.

## Questions

1. Which transport should carry the bar's show/update/hide request?
2. What is the exact payload, ownership split, versioning and failure behavior?
3. Who creates the window, and what layer/anchor/input/focus rules apply?
4. How does the bar behave when capture is down or the request fails?
5. How do multiple monitors and scale map the bar slot to the capture window?
6. How do Pause/Stop stay inside capture without an action IPC back to the bar?
7. What is the migration, test and rollback plan?

## Findings

### 1. Transport investigation

The bar needs a **request/response** path: it must know whether the capture
instance accepted a show/update/hide. Three options were compared.

| Option | Mechanism | New work | Failure when capture is down | Evidence | Verdict |
|---|---|---|---|---|---|
| **A. `ags request` (chosen)** | AGS GApplication remote command line → `io.Astal.Application.Request(as) → s` | None beyond a new `argv[0]` dispatch in the capture request handler | CLI exits 1 and prints `error: instance "capture" is not runnning`; one JSON line on success | Capture already registers a handler (`ags-capture-tool/app.tsx:76-80`); the bar already dispatches argv (`ags-bar/app.tsx:53-61`); AGS registers the handler at `/usr/share/ags/js/lib/gtk4/app.ts:272-296,305-306` and the app id at `:313`; runtime invocation contract `dotfiles-runtime/contracts/ags-app-refresh.md:14-31,37-60`; measured `ags request … -i no-such-instance` → exit 1 | **Smallest correct path** |
| **B. New event-bus request topic** | A hub topic such as `bar.cluster.request`, plus an ack topic | Contracts topic + generated bindings + runtime schema/rate + platform constant + both apps | The hub is not a request broker: emit is at-most-once and there is no per-request response | Hub is "sole emitter" (`contracts/event-contract.json:4`); only `Emit` exists (`:12-22`); unknown topics raise (`dotfiles-runtime/src/runtime/domain/hub.py:61,329-330`); per-topic schema/rate (`dotfiles-runtime/src/runtime/adapters/emit_validation.py:80-102`) | **Reject** — wrong semantics and the largest surface |
| **C. Direct D-Bus interface** | Call `io.Astal.Application.Request` directly instead of spawning `ags` | A Gio/`AppDBus` proxy (or `sendRequest` from `ags/app`) and its error handling | Rejects with a D-Bus error; same handler | Introspected live: `io.Astal.Application.Request(in as) → s` at `/io/Astal/Application` on `io.Astal.<instance>`; generated by `/usr/share/ags/js/lib/app/dbus.ts:10,29-32`; supported helper `/usr/share/ags/js/lib/app/index.ts:48-52` | **Viable optimization**, not the first cut |

**Decision: option A, `ags request`.** It is the documented invocation the
project already uses for `palette-refresh` and for the bar's `popup-close`
keybind (`README.md:51,106`; `dotfiles-runtime/contracts/ags-app-refresh.md:20`),
so it adds no new transport, no topic and no runtime change. The capture app
already answers exactly this transport; the only change is a dispatcher in
front of `paletteRefresh`.

Option C is the same D-Bus call without the CLI process. It is a one-line
swap (`sendRequest("capture", "capture-cluster", json)`) and keeps the exact
same handler/payload, so the implementing session may use it if the per-request
spawn shows up in probes. It is not chosen first because it adds a second
client shape for no behavioral gain; `ags request` is already proven and is
what the runtime/keybind path uses.

**Request grammar.** Use one command name and one JSON argument:

```sh
ags request capture-cluster '<json>' -i capture
```

- `argv[0]` is `capture-cluster`; `argv[1]` is the JSON string.
- The capture handler receives `["capture-cluster", "<json>"]`.
- `palette-refresh` keeps its exact existing shape
  (`["palette-refresh", "<appearance-hash>"]`); the dispatcher must route by
  `argv[0]` and leave the palette-refresh helper's validation untouched.
- The response is **exactly one JSON-encoded string** on stdout, following the
  same discipline as `palette-refresh`
  (`dotfiles-runtime/contracts/ags-app-refresh.md:37-60`).

### 2. Contract payload

The payload is versioned in-band (`v`); there is no new contracts/runtime
document in this cut. Put the TypeScript types and a pure validator in
`ags-platform/ports/capture-cluster.ts` so both apps share one definition
without an app importing another app. If the implementing session wants zero
platform work, the fallback is the same types duplicated in both apps plus a
shared fixture; that is a deliberate second choice, not the default.

```ts
// ags-platform/ports/capture-cluster.ts  (pure: no ags/*, no gi://*)
export const CAPTURE_CLUSTER_COMMAND = "capture-cluster"
export const CAPTURE_CLUSTER_VERSION = 1

export type ClusterPhase = "recording" | "paused" | "idle"
export type ClusterCommand = "show" | "update" | "hide" | "popover-close"
export type ClusterEdge = "top" | "bottom"

/** The bar's slot, in MONITOR-LOCAL logical pixels (origin = monitor top-left). */
export interface ClusterAnchor {
  /** Gdk.Monitor.get_connector(), or null when GDK has not named it. */
  connector: string | null
  /** Fallback identity when connector is null; same logical space. */
  monitorX: number
  monitorY: number
  monitorWidth: number
  monitorHeight: number
  /** Diagnostics/validation only; do not scale x/y/w/h by this. */
  scale: number
  /** Slot origin and exact requested size, monitor-local logical pixels. */
  x: number
  y: number
  width: number
  height: number
  /** Which bar edge the slot sits on; decides popover direction. */
  edge: ClusterEdge
}

export interface ClusterLabels {
  recording: string   // default "Recording"
  paused: string      // default "Recording paused"
  pause: string       // default "Pause"
  resume: string      // default "Resume"
  stop: string        // default "Stop"
}

export interface ClusterRequest {
  v: typeof CAPTURE_CLUSTER_VERSION
  command: ClusterCommand
  /** Per-bar-instance monotonic. Capture drops older seq for the same slot. */
  seq: number
  /** Bar-owned: it owns the slot, so it owns the mode and size. */
  compact: boolean
  /** Required for show/update; absent for hide/popover-close. */
  anchor?: ClusterAnchor
  /**
   * Bar observation only. Capture's `capture.state` feed is authoritative;
   * this is a bootstrap/logging hint if the feed has not delivered yet.
   */
  observed?: {
    phase: ClusterPhase
    jobId?: string | null
    elapsedSeconds?: number
  }
  /** Optional host overrides; capture defaults apply when absent. */
  labels?: Partial<ClusterLabels>
}

export type ClusterResponse =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean }
```

**Ownership, field by field.**

| Field | Owner | Rule |
|---|---|---|
| `v` | Contract / platform | Required. `v:1` only this release. Additive optional fields stay on v1; a breaking change is v2 and the capture instance rejects unknown versions. |
| `command` | Bar | `show` creates/updates, `update` moves/resizes, `hide` unmaps/destroys, `popover-close` is a UI dismissal only. |
| `seq` | Bar | Monotonic per bar instance. Capture keeps the highest `seq` per connector and ignores older ones; prevents a late `update` from undoing a newer `hide`. |
| `compact` | Bar | Bar owns the slot size and therefore the mode. Capture must not re-read `bar_compact_controls` for this window; it renders the requested mode. |
| `anchor.connector` / `monitor*` | Bar | Bar reports the `Gdk.Monitor` of its own window (`gdkmonitor.get_connector()` / `get_geometry()`). |
| `anchor.x/y/width/height` | Bar | Bar measures its slot. Monitor-local logical pixels. Capture only converts to layer-shell margins. |
| `anchor.edge` | Bar | Popover direction. `top` = open below, `bottom` = open above. |
| `anchor.scale` | Bar | Diagnostic only; both sides use logical pixels. |
| `observed.*` | Bar | Observation for bootstrap/logging; capture's `capture.state` wins after the first snapshot. |
| `labels` | Bar (optional) | Defaults are capture-owned; a host may override for localization. |
| phase / timer / pause-resume label | Capture | From the same `RecordingHudState`/`capture.state` reducer the S4 HUD uses. |
| window layer/stacking/keymode/size | Capture | All rendering mechanics. |
| input region / hit test | Capture | Small window is the cluster; hidden means unmapped. |
| popover open/closed | Capture | Bar may request `popover-close`, never `popover-open`. |
| Pause/Stop actions | Capture | `captureState.control(jobId, action)` in-process; no action IPC. |

**Versioning and failure behavior.**

- Missing/invalid JSON, a non-object, missing required fields, or
  `v !== 1` → `{ok:false,error:"bad-request",retryable:false}` (or
  `"unsupported-version"` for a valid-but-unknown `v`). Log at debug, never
  throw, always call `res` exactly once.
- Unknown command → `{ok:false,error:"unknown-command",retryable:false}`.
- `show`/`update` without an anchor → `bad-request`.
- Connector not found and no exact monitor geometry match →
  `{ok:false,error:"unknown-monitor",retryable:true}` (the monitor may be
  mid-hotplug; the bar retries on the next state/anchor change).
- `show` when already shown → update in place, `{ok:true}` (idempotent).
- `update` before `show` → treat as `show`, `{ok:true}` (idempotent; avoids an
  ordering race).
- `hide` when not shown → `{ok:true}` (idempotent).
- `popover-close` when none is open → `{ok:true}` (idempotent).
- Any unexpected exception → `{ok:false,error:"internal",retryable:true}`;
  the app must not die on a bad request.
- A request that cannot be completed synchronously (e.g. monitor lookup not
  ready) returns `retryable:true`; the bar's bounded retry handles it. Do not
  return `ok:true` before the window state is applied.

### 3. Window and rendering

The capture instance owns the whole surface. The bar never creates a layered
window for the cluster.

**Cluster windows (one per monitor/connector).**

The bar draws a bar on every monitor (`ags-bar/app.tsx:161-162`), so each bar
instance asks for its own cluster. Capture keeps a small registry keyed by
connector (geometry fallback when the connector is null) and renders one
cluster per key. A recording is one job, but N bars means N clusters — exactly
today's indicator-on-every-bar behavior. A `show`/`update`/`hide` for one
connector never touches another connector's window.

- Name: `capture-recording-cluster` (new; do not reuse/rename
  `capture-window`, which the launcher and `style.css` select —
  `ui/classic/ClassicWindow.tsx:82-85`). The name is shared by the per-monitor
  windows (as `capture-window` already is); nothing looks it up by name.
  `namespace="capture-cluster"` for compositor rules.
- `gdkmonitor`: resolved from `anchor.connector`, else exact
  `monitorX/Y/Width/Height`; the capture topology already exposes connector
  identity (`adapters/gdk-monitor-topology.ts:64-75`,
  `domain/monitor-registry.ts:78-85,202-214`).
- `layer=Astal.Layer.OVERLAY`: it must draw above the bar, which is
  `EXCLUSIVE`/`TOP|LEFT|RIGHT` (`ags-bar/bar/Bar.tsx:50-57`). The capture S4
  window is already OVERLAY/IGNORE (`ui/classic/ClassicWindow.tsx:898-913`);
  this is the same proven layer.
- `exclusivity=Astal.Exclusivity.IGNORE`: never claim space; a cluster must not
  change `reserved_top` or feed back into the bar's margin.
- `keymode=Astal.Keymode.NONE`: the cluster must not steal keyboard from the
  app being recorded. This is the bar's popup rule too
  (`ags-bar/kit/popup-host.tsx:146-159`). Escape is handled by the global
  `popup-close` request, not by keyboard focus.
- Anchor `TOP|LEFT` with `margin_top=anchor.y`, `margin_left=anchor.x`
  (monitor-local logical). These are the numeric margins Astal applies after
  layer-shell anchoring; layer-shell margins are monitor-relative, which is
  why the payload is monitor-local.
- Exact size: `width_request=anchor.width`, `height_request=anchor.height`.
  The bar reserves the same rect, so the cluster replaces the slot instead of
  shifting neighbours. If GTK's natural size exceeds the request, the live
  probe must show whether to raise the bar's constants or clip; do not let the
  window grow over adjacent widgets silently.
- Hidden = **unmapped/destroyed**. Never keep a mapped transparent surface: a
  mapped layer surface owns an input region and would swallow clicks. This is
  the same rule as the capture S4 hidden state
  (`ui/classic/ClassicWindow.tsx:487-519`, `domain/recording-hud.ts:97-115`).
- Input region: a mapped cluster is intentionally clickable (it is the UI).
  Clicks outside the small cluster land on the bar surface underneath, which is
  already the bar's input area — capture must not claim more than its window.
  Hidden means zero input region (unmapped). Do not try to make the cluster
  "hoverable but click-through" — Wayland has no such region
  (`tickets/SPIKE-001-hover-region/ticket.md:80-99`).

**Popover.**

- Compact mode (`compact: true`) puts Pause/Stop in the popover; full mode
  (`compact: false`) keeps them in the row and never opens a popover. This is
  the existing `hudControlPlacement` rule
  (`domain/recording-hud.ts:145-153`), not a new policy.
- First try a `Gtk.Popover` inside the cluster window, as the current bar widget
  and the capture S4 both do
  (`ags-bar/bar/widgets/recording.tsx:180-214`,
  `ui/classic/ClassicWindow.tsx:1286-1331`). **This must be probed on the
  76×38 surface**: a popup on a tiny layer parent may be clipped or unable to
  open outside the parent. If it fails, use the bar's proven `PopupHost`
  pattern: a separate OVERLAY/IGNORE/NONE popover window plus a full-screen
  catcher (`ags-bar/kit/popup-host.tsx:46-173`). The catcher is mapped only
  while the popover is open and closes on outside click.
- Outside click: `Gtk.Popover` autohide if it works; otherwise the catcher.
- Escape: the cluster has `keymode=NONE`, so it must not rely on a local key
  controller. The bar's existing global `popup-close` handler
  (`ags-bar/app.tsx:53-61`) must forward a `capture-cluster` /
  `popover-close` request to capture, best-effort. This is UI dismissal, not a
  capture action.
- Popover position: above the slot when `edge="bottom"`, below when
  `edge="top"`; clamp into the monitor. Capture owns the popover size and the
  clamp. The bar supplies only the slot rect/edge.
- Only **one** popover is open across all clusters at a time. Opening one closes
  the others; `hide` for a connector closes its own popover.

**Stacking order.** Bar = TOP/EXCLUSIVE. Cluster = OVERLAY. Popover (if a
separate window) and catcher = OVERLAY, catcher created before the popover so
the popover stacks above it (the bar's rule at `ags-bar/app.tsx:164-168`).
Within the same layer, verify creation/present order on the live compositor;
do not assume array order. The cluster must not sit above its own popover.

**What must be verified against AGS/gtk4-layer-shell APIs.**

1. `Astal.Window` accepts `margin_top`/`margin_left` with `anchor=TOP|LEFT`
   and places the surface at the monitor-local rect (enums:
   `@girs/astal-4.0.d.ts:86-91,104-117`; properties `:721-733,758-791`).
2. `Gtk.Widget.compute_bounds(window)` returns the slot rect after allocation
   (`@girs/gtk-4.0.d.ts:137254`), and `Gtk.Widget.get_mapped()`
   (`:137728`) is true only when the bar window is mapped.
3. `Gtk.Popover` on a 76×38 layer surface: opens unclipped, outside-click
   dismisses, Escape reaches it or the global request does. If not, switch to
   the separate-window fallback.
4. The cluster window's input region matches its visual rect; no stray mapped
   surface after hide.
5. Changing `gdkmonitor` after creation is not assumed; on a connector change,
   hide/destroy and recreate on the new monitor.

### 4. Lifecycle and availability

The capture instance is running during a recording it started; B relies on
that. The bar's state machine is deliberately small:

| Trigger | Bar action |
|---|---|
| `capture.state` → `recording`/`paused`, bar window mapped, no cluster shown | `show` with the measured anchor + `compact` |
| Same, bar window unmapped (bar instance not on screen) | no `show`; `hide` for this instance's connector if it had one |
| Anchor/compact changes while shown | `update` (debounced ~100 ms; one in flight; latest wins) |
| `capture.state` → `idle` | `hide` (best-effort) and drop the slot content |
| Hub restart (`onRestart`) | reset to idle; `hide` if needed |
| Bar starts mid-recording | subscribe-before-read hydrates `capture.state`; measure and `show` |
| `show`/`update` request fails | log once per recording, keep the slot empty, bounded retry (250 ms → 1 s → 2 s), then stop until the next state/anchor change |
| Three consecutive `update` failures | best-effort `hide`; do not leave a cluster at a stale position |
| Capture process dies/restarts | the cluster window dies with it; the bar's next retry `show` recreates it |

**No duplicate fallback.** The old `recording.tsx` state/timer/popover is deleted
in phase 2, not retained as a "capture down" fallback. If the capture instance
is down, the bar shows **no cluster** and logs the failure. This is the accepted
B tradeoff: a recording started by the capture UI always has capture running;
a CLI-started recording loses the bar cluster, not the recording. If a fallback
indicator is later required, it must be a separate, explicitly decided minimal
component (for example a dot-only marker), not a second full cluster. Do not
silently reintroduce the old copy.

**Error/visibility behavior.** The bar's slot reservation is a transparent,
non-targetable box (`can_target=false`, no gestures) of the requested size. It
must not draw a border, dot or label. On failure it can collapse to zero width
so the layout does not leave a hole, but it must not draw a fallback. The
decision to collapse is the bar's; it never changes the capture action state.

### 5. Multi-monitor and scale

- The bar creates one window per monitor (`ags-bar/app.tsx:161-162`) and all of
  them are visible; there is no focused-monitor gating in `ags-bar`. So parity
  means **one capture cluster per monitor that reports a slot**, not one global
  cluster that moves. Capture keys the registry by connector (geometry fallback)
  and applies `seq` per key; a `hide` from one bar instance cannot hide another
  monitor's cluster.
- If the product later wants the cluster only on the focused monitor, that is a
  bar-side decision: only the focused bar sends `show`, the others send `hide`.
  Capture stays N-capable and needs no change. Do not decide this implicitly.
- The bar reports its own monitor:
  `gdkmonitor.get_connector()` and `get_geometry()`. Capture resolves the same
  connector; if null, match exact geometry. A connector that has gone away is
  retryable.
- **Coordinate ownership:** bar → monitor-local logical `x/y/w/h`; capture →
  layer-shell `margin_left/top`. The bar's window is anchored
  `TOP|LEFT|RIGHT`, so its origin is the monitor's left/top (today x=0). If the
  bar ever stops stretching, add the window's monitor-local origin before
  sending; capture must not guess it.
- **Scale:** `Gdk.Monitor.get_geometry()`, `Gtk.Widget.compute_bounds()` and
  layer-shell margins are all logical pixels, so no multiply/divide. `scale`
  is carried only to detect a mismatch. Verify on 1x and 2x, and on mixed-scale
  monitors, that each cluster lands exactly over its bar slot; if it does not,
  the bug is in origin/anchor conversion, not in a missing scale factor.
- Negative monitor origins (a monitor left of/above the primary): the payload
  is monitor-local, so `x/y` stay non-negative for a slot on that monitor. Do
  not send global compositor coordinates; that is where the origin bug would
  enter.
- On a monitor hotplug/resolution change, each bar remeasures and sends
  `update`; if the connector is gone, capture destroys that cluster and returns
  `unknown-monitor`. Other monitors are unaffected.

### 6. Actions

Pause/Resume/Stop stay **inside the capture instance**:

- The cluster buttons call the existing `captureState.control(jobId, action)`
  path (`ui/classic/ClassicWindow.tsx:617-620,644-654`,
  `adapters/platform-capture-state-feed.ts`).
- The bar never sends `pause`, `resume` or `stop`; it only observes
  `capture.state` for `recording|paused|idle` and hides/shows the slot. The old
  `ctx.hub.control` use in `recording.tsx:103-110` goes away with the old
  widget.
- The only request that is not pure presentation is `popover-close`, and it
  closes UI, not the recording.
- This preserves the single control path and the capture tool's job-id
  sensitivity, stop-pending behavior and late-snapshot guards
  (`ui/classic/ClassicWindow.tsx:580-654`,
  `domain/recording-hud.ts:186-236`).

### 7. Migration

Use two phases so the bar never loses a working indicator until the replacement
is proven.

**Phase 1 — prove (no deletion).**

1. Add `ags-platform/ports/capture-cluster.ts` (types + validator) and its
   stock-runner tests. Bump both apps to the same platform pin (bar Makefile
   currently pins v0.4.0; `.dev` has v0.4.0 and v0.3.0).
2. Add the capture dispatcher in `app.tsx`: route `palette-refresh` unchanged,
   route `capture-cluster` to a new pure `lib/cluster-request.ts` and a GTK
   `ui/cluster/ClusterWindow.tsx`; add monitor resolution by connector.
3. Add the bar client `bar/lib/cluster-request.ts`, slot measurement
   `domain/cluster-slot.ts`, and a **local toggle** (for example
   `AGSCaptureCluster=1` or a temporary preference) that makes
   `recording.tsx` use the request path instead of the old widget. Default
   stays local in phase 1.
4. Probe: compact/full, top (current bar), pause/resume/stop, popover,
   monitor hotplug/change, scale 1/2, capture killed/restarted, request failure.

**Phase 2 — cut over and delete.**

1. Flip the default to the capture-drawn path.
2. Replace `ags-bar/bar/widgets/recording.tsx` with the small adapter:
   `capture.state` subscription for visibility only, slot measurement, request
   client, no timer, no popover, no `ctx.hub.control`.
3. Delete `ags-bar/style.css:124-246` (`.rec-cluster`, `.rec-dot`, `.rec-timer`,
   `.rec-btn`, `.rec-popup*`, `@keyframes rec-pulse`); keep at most a tiny
   `.rec-slot` rule if the spacer needs it.
4. Delete the phase-1 toggle.
5. Add source guards: the new bar module must contain no
   `GLib.timeout_add`, no `<popover>`, no `pause`/`stop` control call, and the
   old CSS selectors must be absent.

**Files to add/modify/delete.**

| Repo | File | Action |
|---|---|---|
| `ags-platform` | `ports/capture-cluster.ts` | add pure types/validator |
| `ags-platform` | `tests/capture-cluster.test.ts` | add |
| `ags-capture-tool` | `app.tsx` | add dispatcher; preserve `palette-refresh` |
| `ags-capture-tool` | `lib/cluster-request.ts` | add pure parse/validate/handler |
| `ags-capture-tool` | `ui/cluster/ClusterWindow.tsx` | add layer window + cluster/popover |
| `ags-capture-tool` | `domain/cluster-window.ts` | add pure anchor/margin/edge math |
| `ags-capture-tool` | `tests/ts/cluster-request.test.ts` | add |
| `ags-capture-tool` | `tests/ts/cluster-window.test.ts` | add |
| `ags-capture-tool` | `tests/app-contract.test.mjs` | assert both commands are registered |
| `ags-bar` | `bar/widgets/recording.tsx` | replace 218 lines with a small adapter |
| `ags-bar` | `bar/lib/cluster-request.ts` | add client (argv, timeout, retry, coalescing) |
| `ags-bar` | `domain/cluster-slot.ts` | add pure slot rect/size math |
| `ags-bar` | `bar/Bar.tsx`, `bar/registry.ts` | pass the monitor/visibility into the recording spec |
| `ags-bar` | `app.tsx` | forward `popup-close` to capture's `popover-close` |
| `ags-bar` | `style.css` | delete the 123-line copy; keep only a slot rule |
| `ags-bar` | `tests/ts/recording-cluster-client.test.ts` | add |
| `ags-bar` | `tests/ts/recording-slot.test.ts` | add |
| `ags-bar` | `tests/ts/recording-widget-source.test.ts` | add source guard |
| `ags-bar` | `app.manifest.json`, `Makefile` | platform pin only if the shared port lands |

Do **not** touch `contracts/event-contract.json`, `dotfiles-runtime`, the hub, or
provisioning for this change. No new event topic, no runtime schema/rate
change, no new installed unit.

**Tests to add.**

- **Bar request client:** exact argv (`capture-cluster`, JSON, `-i capture`);
  JSON response `{ok:true}` parsed; `{ok:false,...}` classified; timeout after
  1 s; one-in-flight/coalesced updates; bounded retry; no throw on missing
  instance; no duplicate install on re-render.
- **Bar slot:** `compute_bounds(window)` → monitor-local rect; top edge; a
  future bottom edge; negative monitor origin; connector/geometry fallback;
  exact compact/full sizes; invalid/zero geometry returns null (no request).
- **Capture contract conformance:** valid show/update/hide/popover-close;
  malformed JSON; missing anchor; `v:2`; unknown command; unknown monitor;
  idempotent show/hide; exactly one `res` call; `palette-refresh` still routes
  to its existing helper.
- **Capture window positioning:** anchor/margin/edge math for top/bottom and
  left/negative origins; clamp; connector change destroys/recreates; hidden
  window is destroyed/unmapped; source assertion for
  `OVERLAY`/`IGNORE`/`Keymode.NONE` and the new name.
- **IPC failure:** fake sender rejects → bar logs once, slot empty, no crash;
  capture handler throws → `{ok:false,error:"internal",retryable:true}`;
  capture killed → next show retry recovers.
- **Source guards:** bar module has no timer/popover/action control; old CSS
  selectors and `@keyframes rec-pulse` are gone from `ags-bar/style.css`.

### 8. Effort, risks, acceptance, rollback

**Effort (one implementer, including tests and one live probe).**

| Step | Days |
|---|---|
| Platform contract port + validator + tests + pin bump | 0.5 |
| Capture dispatcher + pure request handler + monitor resolution | 0.5 |
| Capture cluster window + reuse HUD state/CSS + popover/dismiss + lifecycle | 1.5–2 |
| Bar client + slot measurement + monitor/visibility wiring | 1 |
| Delete old widget/CSS, source guards, test updates | 0.5 |
| Live probe + acceptance (compact/full, pause/stop, multi-monitor, 1x/2x, failures) | 0.5–1 |
| **Total** | **4.5–5.5 days** (optimistic 4, pessimistic 7 if the popover fallback is needed) |

For comparison, SPIKE-002 estimated 5–8 days for B **including** a new runtime
topic. Avoiding the topic removes the contracts/runtime work but keeps the
window, coordinate and popover work.

**Hard parts / top risks.**

1. **Popover on a tiny layer surface.** `Gtk.Popover` may clip or fail to open
   outside a 76×38 parent; Escape may not reach it with `keymode=NONE`. This is
   why the separate popover window + catcher is a designed fallback, not an
   afterthought. Cost if needed: +0.5–1 day.
2. **Coordinate/scale/multi-monitor equality.** The bar slot is window-local,
   capture needs monitor-local, and layer-shell margins are monitor-relative.
   A wrong origin or a stale connector puts the cluster on the wrong monitor or
   a few pixels off; mixed scale can expose it. This is the most likely
   "passes tests, fails live" failure.
3. **Availability and ordering.** Capture down means no bar indicator; several
   bar instances can race show/update/hide per monitor, and a late `update` can
   undo a newer `hide`. The per-connector `seq`, idempotent handler and bounded
   retry are the mitigations. Do not add a duplicate fallback to hide these
   races.
4. **Slot sizing without a duplicate renderer.** The bar must reserve the exact
   size capture draws. If capture's natural size exceeds it, the cluster clips
   or overlaps neighbours. Measure the live bar before hard-coding; keep the
   constants in one pure function and test them.

**Acceptance (must all hold before phase-2 deletion).**

- [ ] `show`/`update`/`hide` reach capture via `ags request`; `palette-refresh`
      still works; missing capture exits 1 and the bar logs without crashing.
- [ ] The cluster appears exactly over each reporting bar's slot on its monitor,
      in compact and full modes, with no neighbour shift and no clipped content.
- [ ] Pause/Resume/Stop work inside capture; the bar sends no action IPC and
      observes `capture.state` only.
- [ ] Popover opens on the correct side, closes on outside click and on the
      global Esc/`popup-close` path; hidden cluster is unmapped/click-through;
      only one popover is open across all monitors.
- [ ] Multi-monitor: one cluster per reporting bar, no duplicate and no
      cross-monitor hide; a monitor hotplug removes only its own cluster.
- [ ] Scale 1 and 2 (and mixed, if available), top bar, negative-origin
      monitor: each cluster lands on its slot; `hyprctl layers` and screenshots
      are recorded.
- [ ] Capture killed/restarted mid-recording: the bar does not crash, logs the
      failure once, and recovers on the next show/retry.
- [ ] Old bar state/timer/popover/CSS are gone; source guards prove it.
- [ ] `make test`, `make conformance`, `make typecheck`, `make bundle` pass in
      both apps; live evidence saved under `/tmp/opencode/capture-cluster-b/`.

**Rollback.**

- Phase 1: flip the local toggle back to the old widget; no user-visible
  change, no data migration.
- Phase 2: `git revert` the cutover commit restores `recording.tsx` and the CSS
  from git. Capture's handler can stay (inert) or be reverted separately. No
  runtime, topic, provision or data rollback is needed.
- If the platform port was added, revert both app pins together to the prior
  platform tag; the wire contract is app-local and no deployed state depends on
  it.
- No tag, release, deployed pin or provisioning change is part of this work.

## Ready for another session

The implementing session should start with the standalone handoff:
`~/.opencode/plan/handoff-capture-cluster-ipc.md`.

Build order:

1. Platform contract + tests (or the documented duplicate fallback).
2. Capture request dispatcher and pure handler, with `palette-refresh`
   regression tests.
3. Capture cluster window + geometry + popover probe (the riskiest UI step).
4. Bar client + slot measurement + visibility gate, behind the phase-1 toggle.
5. Live probe and acceptance; only then phase 2 deletion of the bar copy.

Do not start by deleting `ags-bar/bar/widgets/recording.tsx`; it is the working
fallback until the capture-drawn path passes the probe.

## Evidence commands

```sh
# SPIKE-002 baseline
git -C /home/inumaki/Development/dotfiles/ags-capture-tool show 9eae551 --stat

# Transport: the existing request handler and the bar's dispatcher
sed -n '76,80p' /home/inumaki/Development/dotfiles/ags-capture-tool/app.tsx
sed -n '53,61p' /home/inumaki/Development/dotfiles/ags-bar/app.tsx
sed -n '272,296p;305,306;313p' /usr/share/ags/js/lib/gtk4/app.ts

# The direct D-Bus surface behind `ags request`
gdbus introspect --session --dest io.Astal.ags \
  --object-path /io/Astal/Application | sed -n '/io.Astal.Application/,/};/p'
sed -n '10,32p' /usr/share/ags/js/lib/app/dbus.ts
sed -n '48,52p' /usr/share/ags/js/lib/app/index.ts

# Missing instance / success behavior (measured)
ags request __probe__ -i no-such-instance-xyz; echo "exit=$?"
ags request __probe__ -i ags; echo "exit=$?"

# No app-to-app event channel
sed -n '1,22p' /home/inumaki/Development/dotfiles/contracts/event-contract.json
sed -n '58,66p' /home/inumaki/Development/dotfiles/contracts/event-contract.json
sed -n '55,62p;325,332p' /home/inumaki/Development/dotfiles/dotfiles-runtime/src/runtime/domain/hub.py
sed -n '80,102p' /home/inumaki/Development/dotfiles/dotfiles-runtime/src/runtime/adapters/emit_validation.py

# Bar window/layer and the duplicate
sed -n '50,57p' /home/inumaki/Development/dotfiles/ags-bar/bar/Bar.tsx
sed -n '124,246p' /home/inumaki/Development/dotfiles/ags-bar/style.css
sed -n '51,218p' /home/inumaki/Development/dotfiles/ags-bar/bar/widgets/recording.tsx

# Capture window/layer and HUD
sed -n '898,913p;1216,1332p' /home/inumaki/Development/dotfiles/ags-capture-tool/ui/classic/ClassicWindow.tsx
sed -n '280,353p' /home/inumaki/Development/dotfiles/ags-capture-tool/style.css
sed -n '90,236p' /home/inumaki/Development/dotfiles/ags-capture-tool/domain/recording-hud.ts

# Geometry primitives
sed -n '137245,137260p;137720,137735p' \
  /home/inumaki/Development/dotfiles/ags-capture-tool/@girs/gtk-4.0.d.ts
sed -n '86,117p' /home/inumaki/Development/dotfiles/ags-capture-tool/@girs/astal-4.0.d.ts
sed -n '65,72p' /home/inumaki/Development/dotfiles/ags-capture-tool/domain/hover-region.ts
```

- Spike time used: ~1.5 h of the 2 h box (read-only source, contract, runtime,
  AGS CLI/D-Bus and layer API review).
- No app code, tags, releases, deployed pins or live probe changed.

## Implementation evidence (branch, 2026-11-04)

Status: implemented and live-probed on dedicated branches. No tag, push,
merge, pin bump, deploy, `tickets/INDEX.md` edit or hover-ticket edit was made.

### Branches and commits

| Repo | Worktree | Branch | HEAD |
|---|---|---|---|
| `ags-platform` | `.worktrees/SPIKE-003/` | `ticket/SPIKE-003-capture-cluster-ipc` | `3e3e6e0` |
| `ags-capture-tool` | `.worktrees/SPIKE-003/` | `ticket/SPIKE-003-capture-cluster-ipc` | commits below |
| `ags-bar` | `.worktrees/SPIKE-003/` | `ticket/SPIKE-003-capture-cluster-ipc` | `1c1e29b` |

- platform `3e3e6e0` — add `ports/capture-cluster.ts` (v1 validator, parser,
  response encoder) + `tests/capture-cluster.test.ts`.
- capture `89e0369` — record worktree/branch.
- capture `766dcd3` — dispatcher, pure request handler, monitor/geometry
  resolution, cluster window/controller, CSS, tests.
- capture `d069d82` — create the cluster JSX inside a gnim `createRoot` so a
  request-time window has a cleanup scope (removes the `out of tracking
  context` critical).
- capture docs commit — record this implementation/gate/live evidence section.
- bar `308ad48` — request client, slot measurement, visibility adapter,
  `popup-close` forwarding, deletion of the old cluster/popover/CSS, tests.
- bar `1c1e29b` — GLib timeout adapter (GJS has no DOM timer) and a 15 s
  liveness update so a capture restart recovers without a bar state change.

### Gates (final run, exit 0)

Logs: `/tmp/opencode/capture-cluster-b/gates/`.

| Gate | Command | Result |
|---|---|---|
| platform | `make test exports typecheck-tests typecheck bundle` | exit 0; 71 tests + 2 export tests; 0 type errors; bundle is the repo's documented TODO stub |
| capture | `make gates` (`AGS_PLATFORM_DEV=…`) | exit 0; tests, conformance, backend 114 passed, bundle, 0 type errors |
| bar | `make gates` (`AGS_PLATFORM_DEV=…`) | exit 0; tests, conformance, drift, bundle, 0 type errors |

`AGS_PLATFORM_DEV` pointed at the platform branch worktree; `CONTRACTS_ROOT`
pointed at the repo's `contracts` checkout. No pin was changed.

### Live evidence

Environment: AGS 3.1.0/3.1.2, GTK 4.22.5, one `eDP-1` 1920×1080 at scale 1 plus
temporary Hyprland headless outputs. Deployed instances were stopped for the
probe and restored afterwards (`ags`, `capture`, `notifications`,
`wallpaper-selector`; headless output removed).

- Transport shape: `ags request capture-cluster '<json>' -i capture` returns
  exactly one JSON string. Live responses observed:
  `{"ok":true}`; `{"ok":false,"error":"unsupported-version","retryable":false}`;
  `{"ok":false,"error":"unknown-monitor","retryable":true}`;
  `{"ok":true}` for `popover-close`.
- Bar-driven cluster: `capture.state` recording → bar measured the slot and
  capture mapped `connector:eDP-1 at {"marginTop":2,"marginLeft":1402,
  "width":92,"height":44}`. `hyprctl layers` showed the overlay at
  `1402 2 92 44`; `grim` crop:
  `/tmp/opencode/capture-cluster-b/shots/cluster-recording-crop.png`.
- Paused: same window, dot/status switched to paused at `00:42`;
  `/tmp/opencode/capture-cluster-b/shots/cluster-paused-crop.png`.
- Hide/idle: `ags request` hide and `capture.state → idle` both removed the
  overlay; `hyprctl layers` had no `capture-cluster`; screenshot:
  `/tmp/opencode/capture-cluster-b/shots/cluster-idle-crop.png`.
- Stale sequence: show seq 100 moved the cluster; hide seq 101 removed it; a
  later update seq 99 did **not** recreate it (all three returned `{"ok":true}`).
- Popover: programmatically opened the capture cluster popover on the 92×44
  layer surface. It rendered unclipped below the slot with Recording / Pause /
  Stop, then auto-closed after ~5 s because no pointer was over it:
  `/tmp/opencode/capture-cluster-b/shots/popover2-crop.png`.
- Negative monitor origin: temporary `HEADLESS-1` at `-1920,0`, scale 1.
  Capture mapped `connector:HEADLESS-1` at local `1402,2`; the compositor layer
  was global `-518 2 92 44`, proving monitor-local coordinates are not shifted:
  `/tmp/opencode/capture-cluster-b/shots/headless-negative-crop.png`.
- 2× scale: `HEADLESS-1` at `-1920,0`, 3840×2160, scale 2. Capture still mapped
  local `1402,2`; the layer remained `-518 2 92 44` in logical coordinates and
  rendered at 2× physical pixels with no scale multiplication:
  `/tmp/opencode/capture-cluster-b/shots/headless-2x-crop.png`.
- Capture kill/restart: killed `capture`; the overlay died with it. Restarted
  capture. The bar's 15 s liveness update retried and capture remapped
  `connector:eDP-1 at {"marginTop":2,"marginLeft":1402,"width":92,"height":44}`
  with no bar state change.
- `popup-close` forwarding: `ags request popup-close -i ags` returned `ok` and
  the bar invoked capture's `popover-close` client path.

### Blockers / integration notes

1. **Platform pin.** The contract lives on `ags-platform` branch
   `ticket/SPIKE-003-capture-cluster-ipc`; app `Makefile` pins remain v0.4.0 /
   v0.3.0. The app branches are not deployable from the pinned tuple until the
   orchestrator integrates/publishes the platform change. Local gates and probes
   used `AGS_PLATFORM_DEV` + the branch worktree; no pin was bumped.
2. **Pointer injection.** No `ydotool`/`wtype`/`xdotool` is installed, so the
   popover was opened programmatically rather than by a synthetic pointer click.
   Opening, rendering, auto-close and the request path are verified; real
   outside-click/Escape delivery to the popover was not directly driven.
3. **Index/rollup.** `tickets/INDEX.md` and the hover tickets were deliberately
   not edited. No bar/platform tickets were created; only this lead ticket
   records the cross-repo refs. The orchestrator owns the rollup and any
   platform release/pin coordination.
4. **Liveness semantics.** The bar sends a 15 s keepalive `update` while a
   cluster is shown. This is the capture-restart recovery path, not a display
   timer; the capture process remains the only timer/state renderer.

### Visual parity correction (JD, 2026-11-04)

The first implementation proved the architecture but rendered the capture HUD's
look. JD requires the capture-drawn cluster to be the **bar's accepted
recording design** (the `.rec-*` card, dot, timer, icon controls and popover),
not the capture HUD. Fixed on the same branch:

- `ags-capture-tool` `f29f5b2` — restore the bar's `.rec-*` CSS and markup
  inside the capture-owned window; use the bar's icon art for Pause/Play/Stop;
  keep the one deliberate `#e0605f` REC red; register the cluster with the
  capture appearance registry so its icon art follows palette refreshes.
- `ags-bar` `e5f3490` — measure from the deployed bar's actual geometry:
  compact card 109×44 + 4px right margin → slot 113×44; full card 161×44 + 4px
  margin → slot 165×44. Remove the extra slot padding and reserve exactly that
  allocation.
- The cluster now fills the reserved height, so the card is 44px tall instead
  of being vertically centered at 34px.
- Resizing compact↔full now re-asserts `set_default_size` after the content
  reflows; a mapped layer surface does not shrink from a size request alone.
- A bar restart resets its local `seq` to 1, which the capture sequence
  tombstones used to reject. `sequenceDecision()` now treats `seq === 1` as a
  new bar generation, and the bar rechecks its measured slot 250ms after the
  first layout pass.

Live evidence (`/tmp/opencode/capture-cluster-b/shots/`):

- compact: layer `1381 2 113 44`; visual card 109×44 at `1381,2` —
  `final-compact-crop.png`.
- full: layer `1329 2 165 44`; visual card 161×44 at `1329,2` —
  `new-cluster-full2-crop.png`.
- old bar reference: `old-bar-recording.png` / `old-bar-full-recording.png`.

Final gates after this correction: `bar-gates-visual.log` and
`capture-gates-visual.log`, both exit 0.

### Shared hover-HUD correction (JD, 2026-11-04)

The previous correction covered only the capture-drawn cluster in the **top
bar**. The capture tool's own hoverable S4 row still used the old
`.capture-bar hud` / `.hud-*` design: text Pause/Stop pills, no icons, and the
palette `@error` dot instead of the bar's `#e0605f`. JD called this out; the
top-bar implementation is the reference for BOTH surfaces.

- `ags-capture-tool` `9b2fdac` — extract `ui/shared/recording-cluster.tsx` as
  the ONE `.rec-*` implementation. `ui/cluster/ClusterWindow.tsx` (top-bar
  overlay) and `ui/classic/ClassicWindow.tsx` (capture hover S4 row) both
  render it. The hover row now has the same dot, timer, icon-only Pause/Play/
  Stop controls, popover and `#e0605f` pulse as the top bar.
- Removed the old `.capture-bar.hud`, `.hud-status`, `.hud-dot`, `.hud-timer`,
  `.hud-actions`, `.hud-toggle`, `.hud-stop`, `.hud-popup` and `rec-pulse`
  CSS. No second HUD vocabulary remains.
- `ags-capture-tool` `28a5efa` — the shared card carries the top bar's compact
  minimum (`109×44`) so the hover card is the same visual size, not the old
  34px-high row.
- Updated the S4/hover source guards to assert the shared component, not the
  deleted HUD classes.

Live evidence: `/tmp/opencode/capture-cluster-b/shots/hover-new2-crop.png`
(shares the dot/timer/card design) and `final-compact-crop.png` (top-bar
reference). The hover layer includes its transparent margin; the visible card
is 109×44. Final capture gates:
`/tmp/opencode/capture-cluster-b/gates/capture-gates-shared-hover-final.log`
(exit 0). Bar commits are unchanged from `e5f3490`.

Note: the test injected `recording_hud: "always"` temporarily to make the
hover surface visible without pointer injection; the user config was restored
to `hover`, `bar_compact_controls: true`, and `capture.state` was reset to idle.
