import app from "ags/gtk4/app"
import { Gdk } from "ags/gtk4"
import style from "./style.css"
// Theming through the platform Theme port (spine AD-13): the adapter owns WHICH
// artifact is applied — the stable `colors.css` pointer, repointed on every
// palette change — so this app does not carry its own `app.apply_css` call.
import { theme } from "ags-platform/adapters/theme"
import { execBackendProbe } from "./adapters/exec-backend-probe"
import { execCaptureLauncher } from "./adapters/exec-capture-launcher"
import { glibSettingsStore } from "./adapters/glib-settings-store"
import { glibUiStateStore } from "./adapters/glib-ui-state-store"
import { gdkMonitorTopology } from "./adapters/gdk-monitor-topology"
import { hyprlandMonitorFocus } from "./adapters/hyprland-monitor-focus"
import {
  createMonitorWindowSet,
  installFocusedWindowLookup,
} from "./adapters/monitor-window-set"
import { createUiState } from "./domain/ui-state"
import { createCapturePaletteRefresh } from "./lib/palette-refresh"
import type { CapturePorts } from "./ports/capture-ports"
import { refreshAppAppearance } from "./ui/appearance"
import { ClassicWindow } from "./ui/classic/ClassicWindow"

// THE RUNTIME-OWNED LIVE REFRESH (AD-27). This is the real capture refresh,
// not a Theme-only acknowledgement:
//
//   1. re-apply the stable Theme pointer, so the stylesheet sees the new
//      palette;
//   2. fan out to EVERY live per-monitor window's appearance surface, where
//      the generated capture icons are removed and rebuilt from the newly
//      regenerated SVG files, then the layer surface size is re-asserted.
//
// The windows themselves are NOT closed, destroyed or recreated. The active
// screenshot/recording/settings surface, the mode switch, the open inline path
// editor, the selected option groups and the single shared `createUiState()`
// object all survive. `createCapturePaletteRefresh` wraps this as the platform
// handler: one JSON-string response, idempotent by appearance hash, and a
// thrown refresh remains retryable.
const paletteRefresh = createCapturePaletteRefresh(() => {
  theme.apply()
  refreshAppAppearance()
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
    backendProbe: execBackendProbe(),
  }
}

app.start({
  instanceName: "capture",
  css: style,
  requestHandler: paletteRefresh,
  main() {
    try {
      theme.apply()
    } catch (error) {
      console.error(`capture-tool: palette CSS apply failed: ${error}`)
    }
    const ports = buildPorts()
    // ONE live UI state for the whole app, built here and handed to every
    // window (fix-capture-per-monitor-state). The persisted selections belong
    // to the application — there is a single `capture-ui.json` and a single
    // settings→defaults→last-used precedence chain — so the loop must NOT give
    // each monitor's window its own copy: two copies diverge on first
    // mutation, and whichever window saves last silently discards the other
    // one's selection. `createUiState()` stays a factory (not a module-level
    // constant) for the same reason `buildPorts()` does: the sharing is this
    // composition root's decision, visible in one place, and swap-able by a
    // test or a second entry point.
    const state = createUiState()

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
      topology: gdkMonitorTopology(Gdk.Display.get_default() as Gdk.Display),
      focus: hyprlandMonitorFocus(),
      createWindow: (monitor) => ClassicWindow(monitor, ports, state),
      report: (message) => console.log(message),
    })
    installFocusedWindowLookup(app, windowSet)
  },
})
