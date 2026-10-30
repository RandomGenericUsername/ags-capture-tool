// ---------------------------------------------------------------------------
// CAPTURE BAR — the recording lane (S1/S3 shell, design.md §3/§5).
//
// Same one-row grammar as the screenshot lane. The GIF conditional rows and the
// custom-duration spin came with the recording page because they are recording
// vocabulary, not page layout; they keep the same `applyingState` guard and are
// only re-shown/hidden, never rebuilt, so a palette refresh cannot reset them.
//
// The CTA and back chevron live in the window (INV-1/INV-2). REQ-004 adds the
// red accent and the S4 live HUD on top of this row; nothing here hardcodes it.
// ---------------------------------------------------------------------------

import { Gtk } from "ags/gtk4"
import { select } from "../shared/groups"
import { withIcon, type IconSlots } from "../shared/icons"
import { durationSelection, isGif, type RecordingUiState } from "../../domain/ui-state"
import type { AudioSource, CaptureTarget, GifScale, RecordingFormat, RecordingQuality } from "../../types"

export interface RecordingPageHandle {
  setVisible: (visible: boolean) => void
  /**
   * Re-assert the recording view's derived state after the window loaded the
   * persisted UI state. Scoped to the spin write on purpose: it is the only
   * statement that can emit `value-changed`, and `applyingState` exists to
   * suppress exactly that feedback loop.
   */
  applyState: () => void
}

export interface RecordingPageProps {
  /** Live selection state. Mutated in place by the page's own handlers. */
  recording: RecordingUiState
  recordingTargetGroup: Array<{ value: CaptureTarget; button: Gtk.Button }>
  recordingFpsGroup: Array<{ value: number; button: Gtk.Button }>
  recordingGifFpsGroup: Array<{ value: number; button: Gtk.Button }>
  recordingFormatGroup: Array<{ value: RecordingFormat; button: Gtk.Button }>
  recordingAudioGroup: Array<{ value: AudioSource; button: Gtk.Button }>
  recordingQualityGroup: Array<{ value: RecordingQuality; button: Gtk.Button }>
  /** 0/10/30/60 seconds, -1 = custom (editor value in `recording`). */
  recordingDurationGroup: Array<{ value: number; button: Gtk.Button }>
  recordingSizeGroup: Array<{ value: GifScale; button: Gtk.Button }>
  /** Settings-derived cursor flag, mirrored into the bar's cursor pills. */
  recordingCursorGroup: Array<{ value: boolean; button: Gtk.Button }>
  setRecordingCursor: (value: boolean) => void
  /** Re-engage the pending overlay when the target pill changes. */
  onTargetChanged: () => void
  /** Per-window icon slots rebuilt by the live palette refresh. */
  icons: IconSlots
  /** Re-assert the layer surface size (the window owns the window handle). */
  syncWindowSize: () => void
  setHandle: (handle: RecordingPageHandle) => void
}

export function RecordingPage(props: RecordingPageProps) {
  const {
    recording,
    recordingTargetGroup,
    recordingFpsGroup,
    recordingGifFpsGroup,
    recordingFormatGroup,
    recordingAudioGroup,
    recordingQualityGroup,
    recordingDurationGroup,
    recordingSizeGroup,
    recordingCursorGroup,
    setRecordingCursor,
    onTargetChanged,
    icons,
    syncWindowSize,
    setHandle,
  } = props

  let recordingView: Gtk.Box | null = null

  // GIF-mode conditional rows.
  let audioRow: Gtk.Box | null = null
  let stdFpsRow: Gtk.Box | null = null
  let gifFpsRow: Gtk.Box | null = null
  let sizeRow: Gtk.Box | null = null

  // Custom-duration inline editor.
  let customBox: Gtk.Box | null = null
  let customSpin: Gtk.SpinButton | null = null
  let applyingState = false

  function applyGifMode() {
    const gif = isGif(recording)
    if (audioRow) audioRow.visible = !gif
    if (stdFpsRow) stdFpsRow.visible = !gif
    if (gifFpsRow) gifFpsRow.visible = gif
    if (sizeRow) sizeRow.visible = gif
  }

  function refreshCustomBox() {
    if (customBox) customBox.visible = durationSelection(recording) === -1
  }

  function setRecordingFormat(format: RecordingFormat, button: Gtk.Button) {
    recording.format = format
    select(button, recordingFormatGroup.map((entry) => entry.button))
    applyGifMode()
    syncWindowSize()
  }

  function applyState() {
    applyingState = true
    try {
      if (customSpin) customSpin.set_value(recording.customDuration)
      applyGifMode()
      refreshCustomBox()
    } finally {
      applyingState = false
    }
  }

  setHandle({
    setVisible: (visible: boolean) => {
      if (recordingView) recordingView.visible = visible
    },
    applyState,
  })

  return (
    <box
      visible={false}
      class="bar-open-view recording-view"
      orientation={Gtk.Orientation.HORIZONTAL}
      spacing={6}
      $={(self) => {
        recordingView = self
      }}
    >
      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="Region"
          $={(self) => recordingTargetGroup.push({ value: "region", button: self })}
          onClicked={(self) => {
            recording.target = "region"
            select(self, recordingTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
        <button
          class="bar-pill"
          label="Screen"
          $={(self) => recordingTargetGroup.push({ value: "screen", button: self })}
          onClicked={(self) => {
            recording.target = "screen"
            select(self, recordingTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
        <button
          class="bar-pill"
          label="Window"
          $={(self) => recordingTargetGroup.push({ value: "window", button: self })}
          onClicked={(self) => {
            recording.target = "window"
            select(self, recordingTargetGroup.map((entry) => entry.button))
            onTargetChanged()
          }}
        />
      </box>

      <box class="bar-divider" />

      <box
        class="bar-group"
        spacing={2}
        $={(self) => {
          stdFpsRow = self
        }}
      >
        <button
          class="bar-pill"
          label="24"
          $={(self) => recordingFpsGroup.push({ value: 24, button: self })}
          onClicked={(self) => {
            recording.fps = 24
            select(self, recordingFpsGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="30"
          $={(self) => recordingFpsGroup.push({ value: 30, button: self })}
          onClicked={(self) => {
            recording.fps = 30
            select(self, recordingFpsGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill selected"
          label="60"
          $={(self) => recordingFpsGroup.push({ value: 60, button: self })}
          onClicked={(self) => {
            recording.fps = 60
            select(self, recordingFpsGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box
        visible={false}
        class="bar-group"
        spacing={2}
        $={(self) => {
          gifFpsRow = self
        }}
      >
        <button
          class="bar-pill"
          label="10"
          $={(self) => recordingGifFpsGroup.push({ value: 10, button: self })}
          onClicked={(self) => {
            recording.gifFps = 10
            select(self, recordingGifFpsGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill selected"
          label="15"
          $={(self) => recordingGifFpsGroup.push({ value: 15, button: self })}
          onClicked={(self) => {
            recording.gifFps = 15
            select(self, recordingGifFpsGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="20"
          $={(self) => recordingGifFpsGroup.push({ value: 20, button: self })}
          onClicked={(self) => {
            recording.gifFps = 20
            select(self, recordingGifFpsGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="30"
          $={(self) => recordingGifFpsGroup.push({ value: 30, button: self })}
          onClicked={(self) => {
            recording.gifFps = 30
            select(self, recordingGifFpsGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="MP4"
          $={(self) => recordingFormatGroup.push({ value: "mp4", button: self })}
          onClicked={(self) => setRecordingFormat("mp4", self)}
        />
        <button
          class="bar-pill"
          label="WebM"
          $={(self) => recordingFormatGroup.push({ value: "webm", button: self })}
          onClicked={(self) => setRecordingFormat("webm", self)}
        />
        <button
          class="bar-pill"
          label="GIF"
          $={(self) => recordingFormatGroup.push({ value: "gif", button: self })}
          onClicked={(self) => setRecordingFormat("gif", self)}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill"
          label="Low"
          $={(self) => recordingQualityGroup.push({ value: "low", button: self })}
          onClicked={(self) => {
            recording.quality = "low"
            select(self, recordingQualityGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="Med"
          $={(self) => recordingQualityGroup.push({ value: "medium", button: self })}
          onClicked={(self) => {
            recording.quality = "medium"
            select(self, recordingQualityGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill selected"
          label="High"
          $={(self) => recordingQualityGroup.push({ value: "high", button: self })}
          onClicked={(self) => {
            recording.quality = "high"
            select(self, recordingQualityGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box
        class="bar-group"
        spacing={2}
        $={(self) => {
          audioRow = self
        }}
      >
        <button
          class="bar-pill selected"
          $={(self) => recordingAudioGroup.push({ value: "system", button: self })}
          onClicked={(self) => {
            recording.audio = "system"
            select(self, recordingAudioGroup.map((entry) => entry.button))
          }}
        >
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $={withIcon("speaker", 14, icons)}
          >
            <label label="Sys" />
          </box>
        </button>
        <button
          class="bar-pill"
          $={(self) => recordingAudioGroup.push({ value: "microphone", button: self })}
          onClicked={(self) => {
            recording.audio = "microphone"
            select(self, recordingAudioGroup.map((entry) => entry.button))
          }}
        >
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={6}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $={withIcon("mic", 14, icons)}
          >
            <label label="Mic" />
          </box>
        </button>
        <button
          class="bar-pill"
          label="None"
          $={(self) => recordingAudioGroup.push({ value: "none", button: self })}
          onClicked={(self) => {
            recording.audio = "none"
            select(self, recordingAudioGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box
        visible={false}
        class="bar-group"
        spacing={2}
        $={(self) => {
          sizeRow = self
        }}
      >
        <button
          class="bar-pill selected"
          label="Original"
          $={(self) => recordingSizeGroup.push({ value: "original", button: self })}
          onClicked={(self) => {
            recording.size = "original"
            select(self, recordingSizeGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="75%"
          $={(self) => recordingSizeGroup.push({ value: "75%", button: self })}
          onClicked={(self) => {
            recording.size = "75%"
            select(self, recordingSizeGroup.map((entry) => entry.button))
          }}
        />
        <button
          class="bar-pill"
          label="50%"
          $={(self) => recordingSizeGroup.push({ value: "50%", button: self })}
          onClicked={(self) => {
            recording.size = "50%"
            select(self, recordingSizeGroup.map((entry) => entry.button))
          }}
        />
      </box>

      <box class="bar-divider" />

      <box class="bar-group" spacing={2}>
        <button
          class="bar-pill selected"
          label="∞"
          $={(self) => recordingDurationGroup.push({ value: 0, button: self })}
          onClicked={(self) => {
            recording.duration = 0
            select(self, recordingDurationGroup.map((entry) => entry.button))
            refreshCustomBox()
          }}
        />
        <button
          class="bar-pill"
          label="10s"
          $={(self) => recordingDurationGroup.push({ value: 10, button: self })}
          onClicked={(self) => {
            recording.duration = 10
            select(self, recordingDurationGroup.map((entry) => entry.button))
            refreshCustomBox()
          }}
        />
        <button
          class="bar-pill"
          label="30s"
          $={(self) => recordingDurationGroup.push({ value: 30, button: self })}
          onClicked={(self) => {
            recording.duration = 30
            select(self, recordingDurationGroup.map((entry) => entry.button))
            refreshCustomBox()
          }}
        />
        <button
          class="bar-pill"
          label="60s"
          $={(self) => recordingDurationGroup.push({ value: 60, button: self })}
          onClicked={(self) => {
            recording.duration = 60
            select(self, recordingDurationGroup.map((entry) => entry.button))
            refreshCustomBox()
          }}
        />
        <button
          class="bar-pill"
          label="Custom"
          $={(self) => recordingDurationGroup.push({ value: -1, button: self })}
          onClicked={(self) => {
            recording.duration = recording.customDuration
            select(self, recordingDurationGroup.map((entry) => entry.button))
            refreshCustomBox()
          }}
        />
        <box
          visible={false}
          class="custom-duration bar-custom-duration"
          spacing={6}
          orientation={Gtk.Orientation.HORIZONTAL}
          valign={Gtk.Align.CENTER}
          $={(self) => {
            customBox = self
            const adjustment = new Gtk.Adjustment({
              lower: 5,
              upper: 3600,
              step_increment: 5,
              page_increment: 30,
              value: recording.customDuration,
            })
            customSpin = new Gtk.SpinButton({ adjustment, digits: 0 })
            customSpin.set_halign(Gtk.Align.START)
            customSpin.set_valign(Gtk.Align.CENTER)
            customSpin.connect("value-changed", () => {
              if (applyingState || customSpin === null) return
              recording.customDuration = customSpin.get_value_as_int()
              recording.duration = recording.customDuration
            })
            self.append(customSpin)
            const unit = new Gtk.Label({ label: "sec" })
            unit.add_css_class("footer-note")
            self.append(unit)
          }}
        />
      </box>

      <box class="bar-divider" />

      <button
        class="bar-pill cursor selected"
        label="Cursor"
        tooltipText="Include the pointer in the recording"
        $={(self) => recordingCursorGroup.push({ value: true, button: self })}
        onClicked={(self) => {
          setRecordingCursor(true)
          select(self, recordingCursorGroup.map((entry) => entry.button))
        }}
      />
      <button
        class="bar-pill"
        label="Off"
        tooltipText="Do not include the pointer"
        $={(self) => recordingCursorGroup.push({ value: false, button: self })}
        onClicked={(self) => {
          setRecordingCursor(false)
          select(self, recordingCursorGroup.map((entry) => entry.button))
        }}
      />
    </box>
  )
}
