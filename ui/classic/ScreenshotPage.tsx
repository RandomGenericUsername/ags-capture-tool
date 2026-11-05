// ---------------------------------------------------------------------------
// CAPTURE BAR — the screenshot lane (S1, EPIC-002 §3.3, REQ-009).
//
// One trigger per field: Target · Monitor · Delay · Format · Output · Cursor.
// The alternatives live in each field's popover, so there is no side-by-side
// option group left in this row. The CTA and the back chevron are owned by the
// window because they are part of the bar's invariant (INV-1/INV-2), not of
// either mode.
//
// The field widgets are built by `ui/shared/dropdown.ts` in `ClassicWindow`;
// this page owns only their order. That keeps the window's field handles as the
// single place `applyStateToUi()` and `closeAllFields()` address.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import type { DropdownFieldHandle } from "../shared/dropdown"

export interface ScreenshotFields {
  target: DropdownFieldHandle
  monitor: DropdownFieldHandle
  delay: DropdownFieldHandle
  format: DropdownFieldHandle
  output: DropdownFieldHandle
  cursor: DropdownFieldHandle
}

export interface ScreenshotPageHandle {
  setVisible: (visible: boolean) => void
}

export interface ScreenshotPageProps {
  /** Field handles in contract order (EPIC-002 §3.3). */
  fields: ScreenshotFields
  setHandle: (handle: ScreenshotPageHandle) => void
}

export function ScreenshotPage(props: ScreenshotPageProps) {
  const { fields, setHandle } = props

  let screenshotView: Gtk.Box | null = null

  setHandle({
    setVisible: (visible: boolean) => {
      if (screenshotView) screenshotView.visible = visible
    },
  })

  return (
    <box
      visible={false}
      class="bar-open-view screenshot-view"
      orientation={Gtk.Orientation.HORIZONTAL}
      spacing={4}
      $={(self) => {
        screenshotView = self
        const lead = new Gtk.Box()
        lead.add_css_class("bar-divider")
        self.append(lead)
        self.append(fields.target.root)
        self.append(fields.monitor.root)
        self.append(fields.delay.root)
        self.append(fields.format.root)
        self.append(fields.output.root)
        self.append(fields.cursor.root)
        const trail = new Gtk.Box()
        trail.add_css_class("bar-divider")
        self.append(trail)
      }}
    />
  )
}
