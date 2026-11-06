import app from "ags/gtk4/app"
import { Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import style from "./style.css"
// The v2 appearance plane (spine AD-13/AD-27): palette, skin and mode are ONE
// generation behind `$XDG_STATE_HOME/dotfiles/current/appearance`. The platform
// adapter owns the single watched hop, the composed provider and its own
// `app.apply_css`-equivalent install, so this app only applies the appearance.
import { createAppearance } from "ags-platform/adapters/appearance"
import { createAppearanceRefreshHandler } from "ags-platform/ports/appearance-refresh"
import { execBackendProbe } from "./adapters/exec-backend-probe"
import { execCaptureLauncher } from "./adapters/exec-capture-launcher"
import { platformCaptureStateFeed } from "./adapters/platform-capture-state-feed"
import { glibSettingsStore } from "./adapters/glib-settings-store"
import { glibUiStateStore } from "./adapters/glib-ui-state-store"
import { gdkMonitorTopology } from "./adapters/gdk-monitor-topology"
import { hyprlandMonitorFocus } from "./adapters/hyprland-monitor-focus"
import { hyprlandMonitorReservedTop } from "./adapters/hyprland-monitor-reserved"
import { hyprlandPointerPosition } from "./adapters/hyprland-pointer-position"
import { hyprlandWindowClients } from "./adapters/hyprland-window-clients"
import { runtimeMonitorCatalog } from "./adapters/runtime-monitor-catalog"
import {
  createMonitorWindowSet,
  installFocusedWindowLookup,
} from "./adapters/monitor-window-set"
import { createOverlayWindowSet } from "./adapters/overlay-window-set"
import { createUiState } from "./domain/ui-state"
import {
  createClusterRequestHandler,
  type ClusterHandler,
} from "./lib/cluster-request"
import { createCaptureRequestHandler } from "./lib/request-dispatch"
import type { CapturePorts } from "./ports/capture-ports"
import { refreshAppAppearance } from "./ui/appearance"
import { ClassicWindow } from "./ui/classic/ClassicWindow"
import { createClusterController } from "./ui/cluster/controller"
import { createSelectionController } from "./ui/overlay/controller"
import { SelectionOverlay } from "./ui/overlay/SelectionOverlay"

// The v2 appearance plane is app-scoped: palette, skin and mode are published
// as ONE generation behind `$XDG_STATE_HOME/dotfiles/current/appearance`, and
// the platform adapter installs the composed sheet as one USER-priority
// provider. Only the stable consumer link
// (`$XDG_CONFIG_HOME/ags-capture/appearance.css`) is per app; the adapter owns
// the single watcher, so a runtime repoint reloads without a capture request.
const appearance = createAppearance({ configDir: "ags-capture" })

// THE RUNTIME-OWNED LIVE REFRESH (AD-27). This is the real capture refresh,
// not a Theme-only acknowledgement:
//
//   1. `createAppearanceRefreshHandler` re-applies the WHOLE appearance
//      (palette + skin + mode), so the stylesheet sees the new generation;
//   2. the app-owned work fans out to EVERY live per-monitor window's
//      appearance surface, where the generated capture icons are removed and
//      rebuilt from the newly regenerated SVG files, then the layer surface
//      size is re-asserted.
//
// The windows themselves are NOT closed, destroyed or recreated. The active
// screenshot/recording/settings surface, the mode switch, the open inline path
// editor, the selected option groups and the single shared `createUiState()`
// object all survive. The platform helper owns the one JSON-string response,
// idempotence by appearance hash, and a thrown refresh remains retryable.
const paletteRefresh = createAppearanceRefreshHandler(appearance, () => {
  refreshAppAppearance()
})

// The cluster controller is built inside `main()` (it needs the live topology
// and the capture-state feed), but AGS registers the request handler before
// `main()` runs. The indirection keeps the palette handler reachable during
// that window and answers a cluster request retryably until the controller is
// ready.
let clusterHandler: ClusterHandler | null = null
const requestHandler = createCaptureRequestHandler(paletteRefresh, (text) => {
  if (clusterHandler === null) {
    return { ok: false, error: "internal", retryable: true }
  }
  return clusterHandler(text)
})

// Composition root (design.md §2, task 8.5). The ONE place that knows which
// adapter satisfies which port, and the only place that builds them.
//
// `buildPorts()` is a factory rather than a module-level constant for one
// reason: it is the seam a test or a second entry point would swap. Nothing
// else in the tool constructs an adapter, so swapping the wiring means editing
// exactly this function and nothing else.
//
// NO LOGIC BELOW THIS POINT beyond "construct the dependencies, then render":
// every decision the panel makes — what the classes are, when a view shows,
// what argv a capture produces — belongs to the domain, the ports or the
// layout, all of which are reachable from here without this file knowing what
// they do.
function buildPorts(): CapturePorts {
  return {
    settingsStore: glibSettingsStore(),
    uiStateStore: glibUiStateStore(),
    launcher: execCaptureLauncher(),
    captureState: platformCaptureStateFeed(),
    backendProbe: execBackendProbe(),
    monitorReservedTop: hyprlandMonitorReservedTop(),
    pointerPosition: hyprlandPointerPosition(),
    monitorCatalog: runtimeMonitorCatalog((argv) => execAsync([...argv])),
  }
}

app.start({
  instanceName: "capture",
  css: style,
  requestHandler,
  main() {
    try {
      // One composed provider carries the palette roles, the skin and the
      // resolved mode over the bundled style.css glass fallback.
      appearance.apply()
    } catch (error) {
      console.error(`capture-tool: appearance CSS apply failed: ${error}`)
    }
    const ports = buildPorts()
    // ONE live UI state for the whole app, built here and handed to every
    // window (fix-capture-per-monitor-state). The persisted selections belong
    // to the application — there is a single `capture-ui.json` and a single
    // capture-ui.json over the code first-run defaults (REQ-012) — so the
    // loop must NOT give
    // each monitor's window its own copy: two copies diverge on first
    // mutation, and whichever window saves last silently discards the other
    // one's selection. `createUiState()` stays a factory (not a module-level
    // constant) for the same reason `buildPorts()` does: the sharing is this
    // composition root's decision, visible in one place, and swap-able by a
    // test or a second entry point.
    const state = createUiState()

    // ONE topology/focus/clients source shared by the bar windows, the overlay
    // windows and the pending-selection controller. The controller is the
    // single owner of "what is selected"; the overlay set is a second,
    // selection-driven window set that mirrors the monitors (design.md §11.2).
    const topology = gdkMonitorTopology(Gdk.Display.get_default() as Gdk.Display)
    // The bar asks this process to draw its recording cluster; this controller
    // owns the window/timer/actions for every reporting monitor. It subscribes
    // once to the same `capture.state` feed the S4 HUD uses.
    const clusterController = createClusterController({
      app,
      topology,
      captureState: ports.captureState,
      report: (message) => console.log(message),
    })
    clusterHandler = createClusterRequestHandler(clusterController)
    const focus = hyprlandMonitorFocus()
    const windowClients = hyprlandWindowClients()
    const selection = createSelectionController({
      topology,
      focus,
      clients: () => windowClients.list(),
    })
    // A client list change is a repaint, never a session change (INV-4).
    windowClients.subscribe(() => selection.refresh())
    createOverlayWindowSet({
      app,
      topology,
      createWindow: (monitor) => SelectionOverlay(monitor, selection),
      report: (message) => console.log(message),
    })

    // The window set owns one window per monitor AND keeps that true when the
    // monitors change (fix-capture-monitor-lifecycle). It used to be a bare
    // `for (const monitor of app.get_monitors())` loop here, which read the
    // list once: a monitor plugged in after login got no window, and one
    // unplugged left its window alive and resolvable by name.
    //
    // It also replaces the name lookup the launcher depends on, so that
    // `ags toggle capture-window` opens the FOCUSED monitor's window instead of
    // whichever duplicate GTK's window list happened to hold first. Both
    // windows still share the name, `style.css` is untouched, and the
    // provisioned launcher needs no change. The reasoning, the measurements and
    // the rejected alternatives are in
    // openspec/changes/fix-capture-monitor-lifecycle/design.md.
    //
    // Each `ClassicWindow` registers its appearance surface from its own
    // `<window>` `$` handler, so the palette-refresh fan-out above always sees
    // the current monitor set without app.tsx tracking windows a second time.
    const windowSet = createMonitorWindowSet({
      app,
      topology,
      focus,
      createWindow: (monitor) => ClassicWindow(monitor, ports, state, selection),
      report: (message) => console.log(message),
    })
    installFocusedWindowLookup(app, windowSet)
  },
})
