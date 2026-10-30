// ---------------------------------------------------------------------------
// CAPTURE BAR — the screenshot lane (S1, design.md §3/§5).
//
// The old centred page is gone: this is one row of pill groups. The CTA and the
// back chevron are owned by the window because they are part of the bar's
// invariant (INV-1/INV-2), not of either mode. Every option the old page
// exposed is still here: target, delay, format, output and cursor.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import { select } from "../shared/groups"
import { withIcon, type IconSlots } from "../shared/icons"
import type { ScreenshotUiState } from "../../domain/ui-state"
import type { CaptureTarget, ScreenshotFormat } from "../../types"

export interface ScreenshotPageHandle {
  setVisible: (visible: boolean) => void
}

export interface ScreenshotPageProps {
  /** Live selection state. Mutated in place by the page's own handlers. */
  screenshot: ScreenshotUiState
  screenshotTargetGroup: Array<{ value: CaptureTarget; button: Gtk.Button }>
  screenshotDelayGroup: Array<{ value: number; button: Gtk.Button }>
  screenshotFormatGroup: Array<{ value: ScreenshotFormat; button: Gtk.Button }>
  screenshotOutputGroup: Array<{ value: boolean; button: Gtk.Button }>
  /** Settings-derived cursor flag, mirrored into the bar's cursor pills. */
  screenshotCursorGroup: Array<{ value: boolean; button: Gtk.Button }>
  setScreenshotCursor: (value: boolean) => void
  /** Re-engage the pending overlay when the target pill changes. */
  onTargetChanged: () => void
  /** Per-window icon slots rebuilt by the live palette refresh. */
  icons: IconSlots
  setHandle: (handle: ScreenshotPageHandle) => void
}

export function ScreenshotPage(props: ScreenshotPageProps) {
  const {
    screenshot,
    screenshotTargetGroup,
    screenshotDelayGroup,
    screenshotFormatGroup,
    screenshotOutputGroup,
    screenshotCursorGroup,
    setScreenshotCursor,
    onTargetChanged,
    icons,
    setHandle,
  } = props

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
      spacing={6}
      $={(self) => {
        screenshotView = self
      }}
    >
      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="Region"
          $={(self) => screenshotTargetGroup.push({ value: "region", button: self })}
          onClicked={(self) => {
            screenshot.target = "region"
            select(self, screenshotTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
        <button
          class="bar-pill"
          label="Screen"
          $={(self) => screenshotTargetGroup.push({ value: "screen", button: self })}
          onClicked={(self) => {
            screenshot.target = "screen"
            select(self, screenshotTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
        <button
          class="bar-pill"
          label="Window"
          $={(self) => screenshotTargetGroup.push({ value: "window", button: self })}
          onClicked={(self) => {
            screenshot.target = "window"
            select(self, screenshotTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="None"
          $={(self) => screenshotDelayGroup.push({ value: 0, button: self })}
          onClicked={(self) => {
            screenshot.delay = 0
            select(self, screenshotDelayGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="3s"
          $={(self) => screenshotDelayGroup.push({ value: 3, button: self })}
          onClicked={(self) => {
            screenshot.delay = 3
            select(self, screenshotDelayGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="5s"
          $={(self) => screenshotDelayGroup.push({ value: 5, button: self })}
          onClicked={(self) => {
            screenshot.delay = 5
            select(self, screenshotDelayGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="10s"
          $={(self) => screenshotDelayGroup.push({ value: 10, button: self })}
          onClicked={(self) => {
            screenshot.delay = 10
            select(self, screenshotDelayGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="PNG"
          $={(self) => screenshotFormatGroup.push({ value: "png", button: self })}
          onClicked={(self) => {
            screenshot.format = "png"
            select(self, screenshotFormatGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="JPEG"
          $={(self) => screenshotFormatGroup.push({ value: "jpeg", button: self })}
          onClicked={(self) => {
            screenshot.format = "jpeg"
            select(self, screenshotFormatGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          $={(self) => screenshotOutputGroup.push({ value: false, button: self })}
          onClicked={(self) => {
            screenshot.save = false
            select(self, screenshotOutputGroup.map((entry) => entry.button))
          }}
        >
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $={withIcon("clipboard", 14, icons)}
          >
            <label label="Clipboard" />
          </box>
        </button>
        <button
          class="bar-pill"
          $={(self) => screenshotOutputGroup.push({ value: true, button: self })}
          onClicked={(self) => {
            screenshot.save = true
            select(self, screenshotOutputGroup.map((entry) => entry.button))
          }}
        >
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $={withIcon("save", 14, icons)}
          >
            <label label="Save" />
          </box>
        </button>
      </box>

      <box class="bar-divider" />

      <button
        class="bar-pill cursor selected"
        label="Cursor"
        tooltipText="Include the pointer in the shot"
        $={(self) => screenshotCursorGroup.push({ value: true, button: self })}
        onClicked={(self) => {
          setScreenshotCursor(true)
          select(self, screenshotCursorGroup.map((entry) => entry.button))
        }}
      />
      <button
        class="bar-pill"
        label="Off"
        tooltipText="Do not include the pointer"
        $={(self) => screenshotCursorGroup.push({ value: false, button: self })}
        onClicked={(self) => {
          setScreenshotCursor(false)
          select(self, screenshotCursorGroup.map((entry) => entry.button))
        }}
      />
    </box>
  )
}
