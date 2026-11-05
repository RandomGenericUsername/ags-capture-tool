// ---------------------------------------------------------------------------
// CLASSIC LAYOUT — the settings view (design.md §2, task 8.4).
//
// Split out of the pre-split `ui/CaptureWindow.tsx` with NO behavioural
// change: the JSX below is a byte-for-byte move of that file's lines 1529-1572,
// leading indentation included, so the rendered widget tree is unchanged and
// `git diff -M` shows a move rather than an edit. Do not re-indent it.
//
// The page owns the settings draft (`settingsConfig`), the four groups
// (`renderSettings`: Files, Behaviour, Placement, Runtime), the inline path
// editor the window's key controller has to defer to, and the backend readout.
// It is REBUILT from disk each time it opens so it always reflects the current
// config; edits mutate the draft and are persisted on leave and immediately
// after every change.
//
// The row builders come from `ui/shared/rows.ts` (A7) — they were extracted
// from this very code and are shared with every future layout. `RowContext` is
// how they see this page's `persistSettings` and its active path editor; the
// builders never close over view state.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import { clearChildren } from "../shared/groups"
import {
  numberRow,
  pathRow,
  pillRow,
  settingsGroup,
  settingsItem,
  toggleRow,
  type PathEditor,
  type RowContext,
} from "../shared/rows"
import type { BackendProbe } from "../../ports/backend-probe"
import type { SettingsStore } from "../../ports/settings-store"
import type {
  CaptureSettings,
  ConfigBarPosition,
} from "../../domain/settings"
import type { RecordingControlsMode } from "../../domain/recording-presentation"
import {
  SETTINGS_RECORDING_CONTROL_OPTIONS,
  SETTINGS_ROW_NAMES,
  settingsGroups,
} from "../shared/settings-defs"

/**
 * What the window needs back from this page.
 *
 * The view container, the rebuild target, the error label, the backend
 * readout, the draft and the inline path editor are all page-local `let`s (the
 * JSX below assigns them in the `$` handlers, unchanged), so the window
 * reaches them through this handle rather than through shared mutable cells.
 */
export interface SettingsPageHandle {
  setVisible: (visible: boolean) => void
  /** Rebuild the four groups from the config on disk. */
  render: () => void
  /** Persist the draft; `false` means the save failed and the view stays open. */
  close: () => boolean
  /** Commit the open inline path editor, if any. `true` if one was open. */
  commitPathEditor: () => boolean
  /** Cancel the open inline path editor, if any. `true` if one was open. */
  cancelPathEditor: () => boolean
}

export interface SettingsPageProps {
  settingsStore: SettingsStore
  backendProbe: BackendProbe
  /** Return to a mode view; called once the draft has been persisted. */
  selectMode: (mode: "screenshot" | "recording") => void
  /** The mode to return to. */
  mode: "screenshot" | "recording"
  /** Re-apply bar placement after a successful settings write. */
  onSettingsChanged: () => void
  setHandle: (handle: SettingsPageHandle) => void
}

export function SettingsPage(props: SettingsPageProps) {
  const { settingsStore, backendProbe, selectMode, mode, onSettingsChanged, setHandle } = props

  let settingsView: Gtk.Box | null = null
  let settingsBody: Gtk.Box | null = null
  let settingsError: Gtk.Label | null = null
  let backendReadout: Gtk.Label | null = null
  // Draft settings edited in the view; persisted on Back/Escape/Enter.
  let settingsConfig: CaptureSettings = settingsStore.load()
  // Active inline path editor, so Enter/Escape commit/cancel it instead of
  // being swallowed by the window's capture-phase key controller.
  let pathEditor: PathEditor | null = null

  const rowContext: RowContext = {
    persistSettings: () => persistSettings(),
    setPathEditor: (editor: PathEditor | null) => {
      pathEditor = editor
    },
  }

  /** Persist settings immediately after every change.
   *
   * They used to save only through closeSettings (the Back button / Enter), so
   * toggling something and then dismissing the window — pressing the keybind
   * again, switching apps — silently discarded the change. That read as "the
   * cursor toggle does nothing": the screenshot kept using the old value.
   */
  function persistSettings(): void {
    const error = settingsStore.save(settingsConfig)
    if (settingsError) {
      settingsError.set_label(error ?? "")
      settingsError.visible = error !== null
    }
    if (error === null) onSettingsChanged()
  }

  function refreshBackendReadout() {
    const readout = backendReadout
    // The probe, the spawn and the `?? "none"` fallback are the adapter's
    // (A5). All that is left here is rendering. Note the `readout ===` re-check:
    // settings can be rebuilt while the probe is in flight, and a stale label
    // would outlive its view.
    backendProbe
      .backend()
      .then((name) => {
        if (readout !== null && readout === backendReadout) {
          readout.set_label(name === "none" ? "Automatic (unavailable)" : `Automatic (${name})`)
        }
      })
      .catch(() => {
        if (readout !== null && readout === backendReadout) readout.set_label("Automatic")
      })
  }

  function renderSettings() {
    if (settingsBody === null) return
    settingsConfig = settingsStore.load()
    clearChildren(settingsBody)
    if (settingsError) {
      settingsError.set_label("")
      settingsError.visible = false
    }

    const [filesDef, behaviourDef, placementDef, runtimeDef] = settingsGroups()

    const filesGroup = settingsGroup(filesDef.title, [
      pathRow(
        SETTINGS_ROW_NAMES.screenshotFolder,
        "Where saved screenshots go",
        () => settingsConfig.screenshot_dir,
        (value) => {
          settingsConfig.screenshot_dir = value
        },
        rowContext,
      ),
      pathRow(
        SETTINGS_ROW_NAMES.recordingFolder,
        "Where finished recordings go",
        () => settingsConfig.recording_dir,
        (value) => {
          settingsConfig.recording_dir = value
        },
        rowContext,
      ),
      pathRow(
        SETTINGS_ROW_NAMES.filenamePattern,
        "Timestamp tokens are expanded at capture time",
        () => settingsConfig.filename_pattern,
        (value) => {
          settingsConfig.filename_pattern = value
        },
        rowContext,
      ),
    ])

    const behaviourGroup = settingsGroup(behaviourDef.title, [
      toggleRow(
        SETTINGS_ROW_NAMES.showNotifications,
        null,
        () => settingsConfig.notifications,
        (value) => {
          settingsConfig.notifications = value
        },
        rowContext,
      ),
      toggleRow(
        SETTINGS_ROW_NAMES.compactBarIndicator,
        "Available for Top bar and Always visible. On hover forces the inline controls so Pause/Stop is one click.",
        () =>
          settingsConfig.bar_compact_controls &&
          settingsConfig.recording_controls !== "hover",
        (value) => {
          settingsConfig.bar_compact_controls = value
        },
        rowContext,
        () => settingsConfig.recording_controls !== "hover",
      ),
    ])

    const placementGroup = settingsGroup(placementDef.title, [
      pillRow<ConfigBarPosition>(
        SETTINGS_ROW_NAMES.barPosition,
        [
          { label: "Bottom", value: "bottom" },
          { label: "Top", value: "top" },
        ],
        () => settingsConfig.bar.position,
        (value) => {
          settingsConfig.bar.position = value
        },
        rowContext,
        // Re-render so Top offset's sensitivity follows the new position.
        () => renderSettings(),
      ),
      numberRow(
        SETTINGS_ROW_NAMES.topOffset,
        "Pixels below the reserved top zone (0 clears the ags-bar zone)",
        () => settingsConfig.bar.offsetPx,
        (value) => {
          settingsConfig.bar.offsetPx = value
        },
        rowContext,
        0,
        2000,
        () => settingsConfig.bar.position === "top",
      ),
      pillRow<RecordingControlsMode>(
        SETTINGS_ROW_NAMES.recordingControls,
        [...SETTINGS_RECORDING_CONTROL_OPTIONS],
        () => settingsConfig.recording_controls,
        (value) => {
          settingsConfig.recording_controls = value
        },
        rowContext,
        () => renderSettings(),
      ),
    ])

    backendReadout = new Gtk.Label({ label: "Automatic", halign: Gtk.Align.END })
    backendReadout.add_css_class("settings-readout")
    const laneMemoryReadout = new Gtk.Label({
      label: "Restored (UI state)",
      halign: Gtk.Align.END,
    })
    laneMemoryReadout.add_css_class("settings-readout")
    const runtimeGroup = settingsGroup(runtimeDef.title, [
      settingsItem(
        SETTINGS_ROW_NAMES.recorderBackend,
        "Chosen automatically after detection",
        backendReadout,
      ),
      settingsItem(
        SETTINGS_ROW_NAMES.laneMemory,
        "Every field's last choice is restored on launch",
        laneMemoryReadout,
      ),
    ])

    settingsBody.append(filesGroup)
    settingsBody.append(behaviourGroup)
    settingsBody.append(placementGroup)
    settingsBody.append(runtimeGroup)
    refreshBackendReadout()
  }

  // Named `closeSettings` (not `close`) because the moved JSX below wires this
  // straight to the Back button; renaming the binding would have meant editing
  // a JSX line, and no JSX line may change.
  function closeSettings(): boolean {
    const error = settingsStore.save(settingsConfig)
    if (error !== null) {
      if (settingsError) {
        settingsError.set_label(error)
        settingsError.visible = true
      }
      return false
    }
    // Save applies forward: mode selections stay exactly as they were.
    onSettingsChanged()
    selectMode(mode)
    return true
  }

  function commitPathEditor(): boolean {
    if (pathEditor === null) return false
    pathEditor.commit()
    pathEditor = null
    return true
  }

  function cancelPathEditor(): boolean {
    if (pathEditor === null) return false
    pathEditor.cancel()
    pathEditor = null
    return true
  }

  setHandle({
    setVisible: (visible: boolean) => {
      if (settingsView) settingsView.visible = visible
    },
    render: () => renderSettings(),
    close: closeSettings,
    commitPathEditor,
    cancelPathEditor,
  })

  return (
        <box
          visible={false}
          class="capture-view"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={0}
          $={(self) => {
            settingsView = self
          }}
        >
          <box class="settings-page" orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <box
              class="settings-head"
              orientation={Gtk.Orientation.HORIZONTAL}
              spacing={16}
            >
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                <label
                  class="settings-title"
                  label="Capture settings"
                  halign={Gtk.Align.START}
                />
                <label
                  class="settings-subtitle"
                  label="The bar remembers every lane choice. This panel is for the things the bar has no room to show."
                  wrap
                  max_width_chars={64}
                  halign={Gtk.Align.START}
                />
              </box>
              <label
                class="settings-save-chip"
                label="Saved as you go"
                halign={Gtk.Align.END}
                valign={Gtk.Align.START}
              />
            </box>
            <box
              orientation={Gtk.Orientation.VERTICAL}
              spacing={0}
              $={(self) => {
                settingsBody = self
              }}
            ></box>
            <label
              visible={false}
              class="settings-error"
              wrap
              halign={Gtk.Align.START}
              $={(self) => {
                settingsError = self
              }}
            />
          </box>
          <box class="panel-footer" spacing={8}>
            <box spacing={4} orientation={Gtk.Orientation.HORIZONTAL}>
              <label class="kbd" label="Esc" />
              <label class="footer-note" label="back  ·" />
              <label class="kbd" label="Enter" />
              <label class="footer-note" label="done" />
            </box>
            <box hexpand halign={Gtk.Align.END}>
              <button class="ghost" label="Back" onClicked={closeSettings} />
            </box>
          </box>
        </box>
)
}