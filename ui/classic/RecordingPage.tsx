// ---------------------------------------------------------------------------
// CAPTURE BAR — the recording lane (S1, EPIC-002 §3.3/§3.4, REQ-010).
//
// One trigger per field: Target · Monitor · FPS/GIF FPS · Format · Quality ·
// Audio/Size · Duration · Cursor. The alternatives live in each field's
// popover, so there is no side-by-side option group left in this row. The CTA,
// back chevron, structural red and S4 live HUD are owned by the window because
// they are part of the bar's invariant, not of either mode.
//
// The field widgets are built by `ui/shared/dropdown.ts` in `ClassicWindow`;
// this page owns only their order. That keeps the window's field handles as the
// single place `applyStateToUi()`, the GIF reflow and `closeAllFields()` address.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import type { DropdownFieldHandle } from "../shared/dropdown"

export interface RecordingFields {
  target: DropdownFieldHandle
  monitor: DropdownFieldHandle
  fps: DropdownFieldHandle
  format: DropdownFieldHandle
  quality: DropdownFieldHandle
  audio: DropdownFieldHandle
  size: DropdownFieldHandle
  duration: DropdownFieldHandle
  cursor: DropdownFieldHandle
}

export interface RecordingPageHandle {
  setVisible: (visible: boolean) => void
}

export interface RecordingPageProps {
  /** Field handles in contract order (EPIC-002 §3.3). */
  fields: RecordingFields
  setHandle: (handle: RecordingPageHandle) => void
}

export function RecordingPage(props: RecordingPageProps) {
  const { fields, setHandle } = props

  let recordingView: Gtk.Box | null = null

  setHandle({
    setVisible: (visible: boolean) => {
      if (recordingView) recordingView.visible = visible
    },
  })

  return (
    <box
      visible={false}
      class="bar-open-view recording-view"
      orientation={Gtk.Orientation.HORIZONTAL}
      spacing={4}
      $={(self) => {
        recordingView = self
        const lead = new Gtk.Box()
        lead.add_css_class("bar-divider")
        self.append(lead)
        self.append(fields.target.root)
        self.append(fields.monitor.root)
        self.append(fields.fps.root)
        self.append(fields.format.root)
        self.append(fields.quality.root)
        self.append(fields.audio.root)
        self.append(fields.size.root)
        self.append(fields.duration.root)
        self.append(fields.cursor.root)
        const trail = new Gtk.Box()
        trail.add_css_class("bar-divider")
        self.append(trail)
      }}
    />
  )
}
