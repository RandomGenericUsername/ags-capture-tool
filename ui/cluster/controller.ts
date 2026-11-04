// ---------------------------------------------------------------------------
// The live set of capture-drawn recording clusters (SPIKE-003 option B).
//
// ONE `capture.state` subscription and ONE timer own every cluster, so two
// monitors can never drift. The bar only asks for show/update/hide; this
// controller resolves the monitor, keeps the highest sequence per cluster and
// destroys the window on hide/idle/restart.
//
// The window lives in `ClusterWindow.tsx`; this module holds lifecycle and the
// authority rules (capture.state wins over the bar's `observed` hint).
// ---------------------------------------------------------------------------

import type { Gdk, Gtk } from "ags/gtk4"
import GLib from "gi://GLib?version=2.0"
import type {
  ClusterAnchor,
  ClusterLabels,
  ClusterRequest,
} from "ags-platform/ports/capture-cluster"
import {
  ClusterHostError,
  type ClusterHost,
} from "../../lib/cluster-request"
import { monitorKey } from "../../domain/monitor-registry"
import {
  clusterPlacement,
  resolveClusterMonitor,
  validClusterAnchor,
} from "../../domain/cluster-window"
import {
  idleHud,
  isHudLive,
  pauseAction,
  reduceCaptureState,
  type RecordingHudState,
} from "../../domain/recording-hud"
import type { CaptureStateFeed, CaptureStatePayload } from "../../ports/capture-state-feed"
import type { MonitorTopology } from "../../ports/monitor-topology"
import {
  ClusterWindow,
  type ClusterWindowHandle,
} from "./ClusterWindow"

type AppWindowHost = {
  add_window(window: Gtk.Window): void
  remove_window(window: Gtk.Window): void
}

export interface ClusterControllerOptions {
  app: AppWindowHost
  topology: MonitorTopology
  captureState: CaptureStateFeed
  now?: () => number
  report?: (message: string) => void
}

export interface ClusterController extends ClusterHost {
  dispose(): void
}

const DEFAULT_LABELS: ClusterLabels = {
  recording: "Recording",
  paused: "Recording paused",
  pause: "Pause",
  resume: "Resume",
  stop: "⏹ Stop",
}

interface ClusterEntry {
  key: string
  monitor: Gdk.Monitor
  anchor: ClusterAnchor
  compact: boolean
  labels: ClusterLabels
  handle: ClusterWindowHandle
}

function labelsFor(request: ClusterRequest): ClusterLabels {
  return { ...DEFAULT_LABELS, ...(request.labels ?? {}) }
}

function bootstrapHud(request: ClusterRequest, now: number): RecordingHudState {
  const observed = request.observed
  if (!observed || observed.phase === "idle") return idleHud()
  return {
    phase: observed.phase,
    elapsedSeconds: observed.elapsedSeconds ?? 0,
    jobId: observed.jobId ?? null,
    syncedAtMs: now,
    endedJobId: null,
  }
}

export function createClusterController(
  options: ClusterControllerOptions,
): ClusterController {
  const { app, topology, captureState } = options
  const now = options.now ?? (() => Date.now())
  const report = options.report ?? (() => {})

  const entries = new Map<string, ClusterEntry>()
  // Sequence tombstones survive a destroyed window, so a late `update` cannot
  // recreate a cluster after a newer `hide`.
  const sequences = new Map<string, number>()
  let hud = idleHud()
  let feedDelivered = false
  let ticker: number | null = null
  let unsubscribeFeed: (() => void) | null = null
  let unsubscribeRestart: (() => void) | null = null
  let openKey: string | null = null
  let disposed = false

  function renderAll(): void {
    for (const entry of entries.values()) {
      entry.handle.render({
        hud,
        labels: entry.labels,
        compact: entry.compact,
      })
    }
  }

  function destroyEntry(key: string): void {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    if (openKey === key) openKey = null
    app.remove_window(entry.handle.window)
    entry.handle.destroy()
  }

  function destroyAll(): void {
    for (const key of [...entries.keys()]) destroyEntry(key)
  }

  function resolve(anchor: ClusterAnchor): {
    key: string
    monitor: Gdk.Monitor
  } {
    if (!validClusterAnchor(anchor)) {
      throw new ClusterHostError(
        "bad-request",
        "slot is outside its monitor or has no size",
        false,
      )
    }
    const descriptors = topology.list().map((entry) => entry.descriptor)
    const descriptor = resolveClusterMonitor(descriptors, anchor)
    if (!descriptor) {
      throw new ClusterHostError(
        "unknown-monitor",
        "no monitor matches the anchor",
        true,
      )
    }
    const key = monitorKey(descriptor)
    const monitor = topology
      .list()
      .find((entry) => monitorKey(entry.descriptor) === key)?.native as
      | Gdk.Monitor
      | undefined
    if (!monitor) {
      throw new ClusterHostError(
        "unknown-monitor",
        "the monitor disappeared during resolution",
        true,
      )
    }
    return { key, monitor }
  }

  function tooStale(key: string, seq: number): boolean {
    return seq < (sequences.get(key) ?? -1)
  }

  function markSequence(key: string, seq: number): void {
    sequences.set(key, Math.max(sequences.get(key) ?? -1, seq))
  }

  function upsert(request: ClusterRequest & { anchor: ClusterAnchor }): void {
    const { key, monitor } = resolve(request.anchor)
    if (tooStale(key, request.seq)) {
      report(`capture-cluster: ignored stale seq ${request.seq} for ${key}`)
      return
    }

    // `capture.state` is authoritative once it has delivered a snapshot. A
    // bar that still thinks a recording is live must not resurrect a cluster
    // after capture has already ended it.
    if (!isHudLive(hud)) {
      if (feedDelivered) return
      hud = bootstrapHud(request, now())
      if (!isHudLive(hud)) return
    }

    markSequence(key, request.seq)
    const existing = entries.get(key)
    if (
      existing &&
      existing.monitor === monitor &&
      existing.anchor.connector === request.anchor.connector
    ) {
      existing.anchor = request.anchor
      existing.compact = request.compact
      existing.labels = labelsFor(request)
      existing.handle.updateLayout(request.anchor)
      existing.handle.render({
        hud,
        labels: existing.labels,
        compact: existing.compact,
      })
      return
    }

    if (existing) destroyEntry(key)

    let entry: ClusterEntry | null = null
    const handle = ClusterWindow({
      gdkmonitor: monitor,
      anchor: request.anchor,
      onToggle: () => {
        if (hud.jobId !== null) captureState.control(hud.jobId, pauseAction(hud))
      },
      onStop: () => {
        if (hud.jobId !== null) captureState.control(hud.jobId, "stop")
      },
      onPopoverOpen: () => {
        for (const [otherKey, other] of entries) {
          if (otherKey !== key) other.handle.closePopover()
        }
        openKey = key
      },
      onPopoverClose: () => {
        if (openKey === key) openKey = null
      },
    })
    entry = {
      key,
      monitor,
      anchor: request.anchor,
      compact: request.compact,
      labels: labelsFor(request),
      handle,
    }
    entries.set(key, entry)
    handle.render({ hud, labels: entry.labels, compact: entry.compact })
    app.add_window(handle.window)
    handle.window.visible = true
    report(`capture-cluster: mapped ${key} at ${JSON.stringify(clusterPlacement(request.anchor))}`)
  }

  function hide(request: ClusterRequest): void {
    if (request.anchor === undefined) {
      destroyAll()
      return
    }
    const descriptors = topology.list().map((entry) => entry.descriptor)
    const descriptor = resolveClusterMonitor(descriptors, request.anchor)
    if (!descriptor) return
    const key = monitorKey(descriptor)
    if (tooStale(key, request.seq)) return
    markSequence(key, request.seq)
    destroyEntry(key)
  }

  function onCaptureState(payload: CaptureStatePayload): void {
    const previousJob = hud.jobId
    const next = reduceCaptureState(hud, payload, now())
    feedDelivered = true
    if (next === hud) return
    // A new job is a new bar generation as far as sequence ordering is
    // concerned. Clearing tombstones lets a restarted bar start at seq 0
    // without an old recording's hide blocking it.
    if (next.jobId !== null && next.jobId !== previousJob) sequences.clear()
    hud = next
    if (!isHudLive(hud)) {
      destroyAll()
      return
    }
    renderAll()
  }

  unsubscribeFeed = captureState.subscribe(onCaptureState)
  unsubscribeRestart = captureState.onRestart(() => {
    hud = idleHud()
    feedDelivered = true
    destroyAll()
  })
  ticker = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
    if (hud.phase === "recording" && entries.size > 0) renderAll()
    return true
  })

  return {
    show: upsert,
    update: upsert,
    hide,
    popoverClose(): void {
      for (const entry of entries.values()) entry.handle.closePopover()
      openKey = null
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      if (ticker !== null) {
        GLib.source_remove(ticker)
        ticker = null
      }
      if (unsubscribeFeed !== null) {
        unsubscribeFeed()
        unsubscribeFeed = null
      }
      if (unsubscribeRestart !== null) {
        unsubscribeRestart()
        unsubscribeRestart = null
      }
      destroyAll()
    },
  }
}
