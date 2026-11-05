// ---------------------------------------------------------------------------
// The reusable capture field trigger/popover (EPIC-002 §3.1/§3.2, REQ-009).
//
// One `Gtk.MenuButton` per field, a `Gtk.Popover` anchored to it, and a
// `Gtk.ListBox` for the rows. The trigger shows key + active value + chevron;
// the popover owns the alternatives. The popover is a separate `Gdk.Popup`, so
// opening/closing it never resizes the layer surface and this module never
// calls `syncWindowSize()`.
//
// KEYBOARD OWNERSHIP
//   * The window's capture-phase controller keeps Enter/Esc/arrows when the
//     popover is closed (Enter = commit; Space/↓ = open via the trigger
//     controller below).
//   * While open the window returns `false`; this module's popover controller
//     owns Esc (close), Enter/Space (choose), and lets ↑/↓ reach the ListBox.
//   * Closing returns focus to the trigger.
//
// Palette: symbolic icons inherit `color`, so a palette refresh does not need
// to rebuild the popover rows and must not close an open popover.
// ---------------------------------------------------------------------------

import { Gdk, Gtk } from "ags/gtk4"
import type { BarFieldPresentation, FieldOptionDef } from "./field-defs"

/** The handles a footer gets: commit a value, close, or return to the list. */
export interface DropdownFooterControls {
  /** Set the trigger value and the row that reads as selected. */
  setValue: (value: string, selectedValue?: string) => void
  close: () => void
  focusList: () => void
}

/**
 * The smallest extension REQ-010 needs: an optional widget below the list.
 * The duration editor uses it so the extra control lives inside the popover
 * instead of growing the bar. A footer can keep the popover open for its own
 * row (`onActivate`) and owns Enter/Esc while its editor has focus (`onKey`).
 */
export interface DropdownFooterConfig {
  build: (controls: DropdownFooterControls) => Gtk.Widget
  onOpen?: () => void
  onClose?: () => void
  /** Return true when the footer consumed the key. */
  onKey?: (keyval: number) => boolean
  /** Return true to keep the popover open after this row is activated. */
  onActivate?: (value: string) => boolean
  /** A row was chosen for real (the popover is about to close). */
  onChoose?: (value: string) => void
}

export interface DropdownFieldConfig {
  /** Uppercase trigger key and popover title, from the design contract. */
  key: string
  /** One-line popover purpose, from the design contract. */
  description: string
  options: readonly FieldOptionDef[]
  /** Active contract value (for example `Region`, `3s`, a connector name). */
  value: string
  /** Row that reads as selected when it differs from the trigger text. */
  selectedValue?: string
  /** Show the selected option's icon beside the key (Target and Monitor). */
  lead?: boolean
  /** Recording fields use the red open ring and popover selection. */
  accent?: "primary" | "recording"
  /**
   * REQ-014: `compact` is the trigger/popover, `detailed` is the inline option
   * group. The same `options` array feeds both. Defaults to `compact`.
   */
  presentation?: BarFieldPresentation
  /** Popover direction; bottom bars open TOP, top bars open BOTTOM. */
  popoverPosition?: () => Gtk.PositionType
  /** Optional extra widget appended below the list (custom duration). */
  footer?: DropdownFooterConfig
  onSelect: (value: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface DropdownFieldHandle {
  /** The field widget the page appends to its row. */
  root: Gtk.Widget
  setValue: (value: string, selectedValue?: string) => void
  setOptions: (options: readonly FieldOptionDef[]) => void
  setKey: (key: string) => void
  setDescription: (description: string) => void
  setEnabled: (enabled: boolean) => void
  setVisible: (visible: boolean) => void
  /** Switch between the compact trigger/popover and the detailed inline group. */
  setPresentation: (presentation: BarFieldPresentation) => void
  /**
   * True while an inline editor (the detailed duration spin) owns Enter/Esc.
   * The window's capture-phase controller defers to it, exactly as it does to
   * an open popover.
   */
  isEditing?: () => boolean
  getValue: () => string
  getSelectedValue: () => string
  open: () => void
  close: () => void
  isOpen: () => boolean
  destroy: () => void
}

/**
 * Contract icon ids -> symbolic theme icons.
 *
 * The contract names the vocabulary; the theme names the glyph. Symbolic icons
 * are deliberate: they inherit the CSS `color`, so an open popover survives a
 * palette refresh without rebuilding its rows. An unmapped id simply renders
 * the text-only row rather than inventing art.
 */
const SYMBOLIC_ICONS: Record<string, string> = {
  "i-region": "edit-select-all-symbolic",
  "i-screen": "video-display-symbolic",
  "i-window": "window-new-symbolic",
  "i-clock": "appointment-new-symbolic",
  "i-image": "image-x-generic-symbolic",
  "i-clipboard": "edit-copy-symbolic",
  "i-save": "document-save-symbolic",
  "i-cursor": "input-mouse-symbolic",
  "i-cursor-off": "input-mouse-symbolic",
}

function symbolicIcon(icon: string | undefined, size: number): Gtk.Image | null {
  const name = icon === undefined ? undefined : SYMBOLIC_ICONS[icon]
  if (name === undefined) return null
  const image = new Gtk.Image({ icon_name: name, pixel_size: size })
  return image
}

export function dropdownField(config: DropdownFieldConfig): DropdownFieldHandle {
  let currentValue = config.value
  let currentSelected = config.selectedValue ?? config.value
  let currentOptions: readonly FieldOptionDef[] = config.options
  let currentPresentation: BarFieldPresentation = config.presentation ?? "compact"
  let restoreFocus = false

  const root = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
  root.add_css_class("field")
  if (config.accent === "recording") root.add_css_class("field-recording")

  // A plain Gtk.Button, not Gtk.MenuButton: MenuButton brings the theme's
  // button chrome around the trigger and a second popover background, which
  // reads as "containers inside containers". The button is the trigger node
  // and `.field-trigger` can be fully flat at rest.
  const trigger = new Gtk.Button()
  trigger.add_css_class("field-trigger")
  root.append(trigger)

  const triggerContent = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 4,
    valign: Gtk.Align.CENTER,
  })
  trigger.set_child(triggerContent)

  let lead: Gtk.Image | null = null
  if (config.lead === true) {
    lead = new Gtk.Image({ pixel_size: 15 })
    lead.add_css_class("field-lead")
    triggerContent.append(lead)
  }

  const copy = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  const keyLabel = new Gtk.Label({ label: config.key, halign: Gtk.Align.START })
  keyLabel.add_css_class("field-key")
  const valueLabel = new Gtk.Label({ label: config.value, halign: Gtk.Align.START })
  valueLabel.add_css_class("field-value")
  copy.append(keyLabel)
  copy.append(valueLabel)
  triggerContent.append(copy)

  const chevron = new Gtk.Image({ icon_name: "pan-down-symbolic", pixel_size: 8 })
  chevron.add_css_class("field-chevron")
  triggerContent.append(chevron)

  // REQ-014 detailed presentation: the SAME options array rendered as an
  // inline key + pill group. The trigger/popover above stay built so a switch
  // back to compact is only a visibility change; no handle is rebuilt.
  const inline = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 5,
    valign: Gtk.Align.CENTER,
  })
  inline.add_css_class("inline-field")
  const inlineKey = new Gtk.Label({ label: config.key, halign: Gtk.Align.START })
  inlineKey.add_css_class("inline-key")
  const inlineGroup = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 2,
    valign: Gtk.Align.CENTER,
  })
  inlineGroup.add_css_class("inline-group")
  inline.append(inlineKey)
  inline.append(inlineGroup)
  root.append(inline)

  const popover = new Gtk.Popover()
  popover.add_css_class("field-popover")
  if (config.accent === "recording") popover.add_css_class("field-popover-recording")
  // No oversized theme arrow; the panel is anchored to the field root.
  popover.set_has_arrow(false)
  popover.set_autohide(true)
  popover.set_position(
    config.popoverPosition === undefined ? Gtk.PositionType.TOP : config.popoverPosition(),
  )
  // The field root is a Box, so the popover is a special child of the root
  // rather than competing with the Button's single child.
  popover.set_parent(root)

  const body = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  popover.set_child(body)

  const header = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  header.add_css_class("field-pop-header")
  const title = new Gtk.Label({ label: config.key, halign: Gtk.Align.START })
  title.add_css_class("field-pop-title")
  const description = new Gtk.Label({ label: config.description, halign: Gtk.Align.START })
  description.add_css_class("field-pop-desc")

  function setKey(key: string): void {
    keyLabel.set_label(key)
    title.set_label(key)
    inlineKey.set_label(key)
  }

  function setDescription(next: string): void {
    description.set_label(next)
  }
  header.append(title)
  header.append(description)
  body.append(header)

  const list = new Gtk.ListBox()
  list.add_css_class("field-list")
  list.set_selection_mode(Gtk.SelectionMode.SINGLE)
  list.set_activate_on_single_click(true)
  body.append(list)

  let rows: Array<{ option: FieldOptionDef; row: Gtk.ListBoxRow }> = []
  let pills: Array<{ option: FieldOptionDef; button: Gtk.Button }> = []

  function displayValue(value: string): string {
    const option = currentOptions.find((entry) => entry.value === value)
    return option === undefined ? value : option.label
  }

  function selectedOption(): FieldOptionDef | null {
    return currentOptions.find((entry) => entry.value === currentSelected) ?? null
  }

  function syncLead(): void {
    if (lead === null) return
    const option = selectedOption()
    const name = option === null ? undefined : SYMBOLIC_ICONS[option.icon]
    if (name === undefined) {
      lead.visible = false
      return
    }
    lead.set_from_icon_name(name)
    lead.set_pixel_size(15)
    lead.visible = true
  }

  function markSelected(): void {
    for (const entry of rows) {
      if (entry.option.value === currentSelected) entry.row.add_css_class("field-selected")
      else entry.row.remove_css_class("field-selected")
    }
    for (const entry of pills) {
      if (entry.option.value === currentSelected) entry.button.add_css_class("selected")
      else entry.button.remove_css_class("selected")
    }
    const selected = rows.find((entry) => entry.option.value === currentSelected)
    if (selected !== undefined) list.select_row(selected.row)
  }

  function clearRows(): void {
    let child = list.get_first_child()
    while (child !== null) {
      const next = child.get_next_sibling()
      list.remove(child)
      child = next
    }
    rows = []
  }

  function clearPills(): void {
    let child = inlineGroup.get_first_child()
    while (child !== null) {
      const next = child.get_next_sibling()
      inlineGroup.remove(child)
      child = next
    }
    pills = []
  }

  /**
   * REQ-014: the detailed renderer iterates the SAME `currentOptions` as the
   * popover. There is no second option table; `setOptions()` refreshes both.
   */
  function rebuildPills(): void {
    clearPills()
    for (const option of currentOptions) {
      const button = new Gtk.Button({ label: option.label })
      button.add_css_class("inline-pill")
      button.set_valign(Gtk.Align.CENTER)
      button.connect("clicked", () => chooseInline(option.value))
      inlineGroup.append(button)
      pills.push({ option, button })
    }
    markSelected()
  }

  function rebuildRows(): void {
    clearRows()
    for (const option of currentOptions) {
      const row = new Gtk.ListBoxRow()
      row.add_css_class("field-option")
      row.set_activatable(true)
      row.set_selectable(true)

      const content = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 9,
        valign: Gtk.Align.CENTER,
      })

      const icon = symbolicIcon(option.icon, 16)
      if (icon !== null) {
        icon.add_css_class("field-option-icon")
        content.append(icon)
      }

      const text = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 1,
        hexpand: true,
      })
      text.add_css_class("field-option-text")
      const label = new Gtk.Label({ label: option.label, halign: Gtk.Align.START })
      label.add_css_class("field-option-label")
      text.append(label)
      const optionDescription = new Gtk.Label({
        label: option.description,
        halign: Gtk.Align.START,
      })
      optionDescription.add_css_class("field-option-desc")
      text.append(optionDescription)
      content.append(text)

      const radio = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
      })
      radio.add_css_class("field-radio")
      radio.append(new Gtk.Label({ label: "✓" }))
      content.append(radio)

      row.set_child(content)
      list.append(row)
      rows.push({ option, row })
    }
    rebuildPills()
    markSelected()
    syncLead()
  }

  function applyValue(value: string, selectedValue?: string): void {
    currentValue = value
    currentSelected = selectedValue ?? value
    valueLabel.set_label(displayValue(value))
    markSelected()
    syncLead()
  }

  function isOpen(): boolean {
    return currentPresentation === "compact" && popover.get_visible()
  }

  function close(): void {
    if (currentPresentation === "detailed" || !isOpen()) return
    popover.popdown()
  }

  function chooseInline(value: string): void {
    // Same footer hooks as the compact row: a footer may keep its own row
    // selected without replacing the trigger value (duration Custom).
    if (config.footer?.onActivate?.(value) === true) return
    config.footer?.onChoose?.(value)
    applyValue(value)
    config.onSelect(value)
  }

  function choose(value: string): void {
    // A footer may keep the popover open for its own row (duration Custom).
    if (config.footer?.onActivate?.(value) === true) return
    config.footer?.onChoose?.(value)
    applyValue(value)
    restoreFocus = true
    close()
    config.onSelect(value)
  }

  function setPresentation(presentation: BarFieldPresentation): void {
    // Close before flipping the flag: `close()` is a no-op once detailed, and a
    // popover must never outlive the compact renderer.
    if (presentation === "detailed" && popover.get_visible()) popover.popdown()
    currentPresentation = presentation
    const detailed = presentation === "detailed"
    root.remove_css_class("field-compact")
    root.remove_css_class("field-detailed")
    root.add_css_class(detailed ? "field-detailed" : "field-compact")
    trigger.visible = !detailed
    inline.visible = detailed
  }

  function open(): void {
    if (currentPresentation === "detailed") return
    if (!trigger.get_sensitive() || !root.get_visible()) return
    popover.set_position(
      config.popoverPosition === undefined ? Gtk.PositionType.TOP : config.popoverPosition(),
    )
    popover.popup()
  }

  // Optional footer inside the popover (REQ-010 custom duration). It is built
  // once with the rest of the popover; opening/closing only shows or hides it,
  // so the bar never reflows and no popup is rebuilt.
  if (config.footer !== undefined) {
    const controls: DropdownFooterControls = {
      setValue: (value, selectedValue) => applyValue(value, selectedValue),
      close,
      focusList: () => list.grab_focus(),
    }
    body.append(config.footer.build(controls))
  }

  trigger.connect("clicked", () => {
    if (isOpen()) close()
    else open()
  })

  list.connect("row-activated", (_list, row) => {
    const entry = rows.find((candidate) => candidate.row === row)
    if (entry === undefined) return
    choose(entry.option.value)
  })

  // The popover is a separate surface; this controller only sees keys after
  // the window's capture-phase controller deliberately returns `false`.
  const popoverKeys = new Gtk.EventControllerKey()
  popoverKeys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  popoverKeys.connect("key-pressed", (_controller, keyval) => {
    // A focused footer editor (the duration spin) owns Enter/Esc first.
    if (config.footer?.onKey?.(keyval) === true) return true
    if (keyval === Gdk.KEY_Escape) {
      restoreFocus = true
      close()
      return true
    }
    if (
      keyval === Gdk.KEY_Return ||
      keyval === Gdk.KEY_KP_Enter ||
      keyval === Gdk.KEY_space
    ) {
      const selected = list.get_selected_row()
      const entry =
        selected === null
          ? undefined
          : rows.find((candidate) => candidate.row === selected)
      if (entry !== undefined) choose(entry.option.value)
      return true
    }
    if (keyval === Gdk.KEY_Tab) {
      // Tab closes and moves on; the closed handler returns focus to the
      // trigger, then GTK continues the focus traversal.
      close()
      return false
    }
    return false
  })
  popover.add_controller(popoverKeys)

  // Enter never opens a field (Enter is commit). Space/↓ open when the trigger
  // itself has focus and the popover is closed.
  const triggerKeys = new Gtk.EventControllerKey()
  triggerKeys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  triggerKeys.connect("key-pressed", (_controller, keyval) => {
    if (isOpen()) return false
    if (keyval === Gdk.KEY_space || keyval === Gdk.KEY_Down) {
      open()
      return true
    }
    return false
  })
  trigger.add_controller(triggerKeys)

  let openNotified = false

  popover.connect("map", () => {
    // Both the trigger controller and Gtk.MenuButton's own click path land
    // here. Notifying from `map` (not only from `open()`) is what keeps
    // `activePopover` correct when the user clicks the trigger: the window's
    // capture-phase controller must defer Esc/Enter/arrows for a click-opened
    // popover too.
    if (!openNotified) {
      openNotified = true
      config.onOpen?.()
    }
    root.add_css_class("field-open")
    chevron.set_from_icon_name("pan-up-symbolic")
    list.grab_focus()
    const selected = list.get_selected_row()
    if (selected !== null) selected.grab_focus()
    config.footer?.onOpen?.()
  })

  popover.connect("closed", () => {
    openNotified = false
    root.remove_css_class("field-open")
    chevron.set_from_icon_name("pan-down-symbolic")
    const shouldRestore = restoreFocus
    restoreFocus = false
    config.footer?.onClose?.()
    config.onClose?.()
    if (shouldRestore) trigger.grab_focus()
  })

  rebuildRows()
  setPresentation(currentPresentation)

  return {
    root,
    setValue(value: string, selectedValue?: string): void {
      applyValue(value, selectedValue)
    },
    setOptions(options: readonly FieldOptionDef[]): void {
      currentOptions = options
      rebuildRows()
    },
    setKey,
    setDescription,
    setEnabled(enabled: boolean): void {
      trigger.set_sensitive(enabled)
      inlineGroup.set_sensitive(enabled)
      if (!enabled) close()
    },
    setVisible(visible: boolean): void {
      root.set_visible(visible)
      if (!visible) close()
    },
    setPresentation,
    isEditing(): boolean {
      return false
    },
    getValue(): string {
      return currentValue
    },
    getSelectedValue(): string {
      return currentSelected
    },
    open,
    close,
    isOpen,
    destroy(): void {
      close()
      root.set_visible(false)
      if (popover.get_parent() !== null) popover.unparent()
    },
  }
}

// ---------------------------------------------------------------------------
// Custom duration (REQ-010 §3.4): the presets stay list rows; the exact-seconds
// editor is a footer inside the SAME popover. The bar only ever renders the
// trigger, so opening the editor cannot grow the row.
// ---------------------------------------------------------------------------

export interface DurationFieldConfig {
  key: string
  description: string
  options: readonly FieldOptionDef[]
  /** Trigger text: a preset label (`∞`, `10s`) or `${seconds}s`. */
  value: string
  /** `Custom` when the current duration is not one of the presets. */
  selectedValue: string
  /** Current custom seconds; read lazily so `applyStateToUi` is enough. */
  customSeconds: () => number
  accent?: "primary" | "recording"
  /** REQ-014: detailed reveals the inline seconds editor; compact uses the popover. */
  presentation?: BarFieldPresentation
  popoverPosition?: () => Gtk.PositionType
  /** A preset row was activated (contract value). */
  onPreset: (value: string) => void
  /** The editor committed an exact seconds value. */
  onCustom: (seconds: number) => void
  onOpen?: () => void
  onClose?: () => void
}

export function durationField(config: DurationFieldConfig): DropdownFieldHandle {
  let editor: Gtk.Box | null = null
  let spin: Gtk.SpinButton | null = null
  let setButton: Gtk.Button | null = null
  let controls: DropdownFooterControls | null = null
  let inlineEditor: Gtk.Box | null = null
  let inlineSpin: Gtk.SpinButton | null = null
  let inlineSetButton: Gtk.Button | null = null
  let detailed = (config.presentation ?? "compact") === "detailed"
  let pending = false
  let committed = false
  let previousValue = config.value
  let previousSelected = config.selectedValue
  let previousSeconds = config.customSeconds()

  let handle: DropdownFieldHandle

  function clampSeconds(value: number): number {
    return Math.max(1, Math.min(3600, Math.round(value)))
  }

  function showEditor(visible: boolean): void {
    if (editor !== null) editor.visible = visible
  }

  function showInlineEditor(visible: boolean): void {
    if (inlineEditor !== null) inlineEditor.visible = visible
  }

  function editorVisible(): boolean {
    return editor !== null && editor.get_visible()
  }

  function hasFocus(widget: Gtk.Widget | null): boolean {
    return widget !== null && (widget.has_focus || widget.get_focus_child() !== null)
  }

  function editorFocused(): boolean {
    return hasFocus(spin) || hasFocus(setButton)
  }

  function inlineEditorFocused(): boolean {
    return hasFocus(inlineSpin) || hasFocus(inlineSetButton)
  }

  /**
   * Shared commit path for both presentations: the compact footer editor and
   * the detailed inline editor publish the same exact seconds through
   * `onCustom`, so switching presentation cannot change the stored value.
   */
  function commitSeconds(raw: number): void {
    const seconds = clampSeconds(raw)
    if (spin !== null) spin.set_value(seconds)
    if (inlineSpin !== null) inlineSpin.set_value(seconds)
    pending = false
    committed = true
    showEditor(false)
    showInlineEditor(false)
    if (detailed) {
      handle.setValue(`${seconds}s`, "Custom")
    } else {
      if (controls !== null) controls.setValue(`${seconds}s`, "Custom")
      handle.close()
    }
    config.onCustom(seconds)
  }

  function commitCustom(): void {
    if (spin === null || controls === null) return
    commitSeconds(spin.get_value_as_int())
  }

  function commitInlineCustom(): void {
    if (inlineSpin === null) return
    commitSeconds(inlineSpin.get_value_as_int())
  }

  function restoreSeconds(): void {
    if (spin !== null) spin.set_value(previousSeconds)
    if (inlineSpin !== null) inlineSpin.set_value(previousSeconds)
    pending = false
    showEditor(false)
    showInlineEditor(false)
    if (detailed) {
      handle.setValue(previousValue, previousSelected)
    } else {
      controls?.setValue(previousValue, previousSelected)
      handle.close()
    }
  }

  function restoreCustom(): void {
    restoreSeconds()
  }

  /** The editor owns Enter/Esc while it has focus (popover or spin controller). */
  function editorKey(keyval: number): boolean {
    if (!pending || !editorFocused()) return false
    if (keyval === Gdk.KEY_Escape) {
      restoreCustom()
      return true
    }
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      commitCustom()
      return true
    }
    return false
  }

  /** The detailed inline editor owns Enter/Esc while it has focus. */
  function inlineEditorKey(keyval: number): boolean {
    if (!detailed || !pending || !inlineEditorFocused()) return false
    if (keyval === Gdk.KEY_Escape) {
      restoreCustom()
      return true
    }
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      commitInlineCustom()
      return true
    }
    return false
  }

  function beginInlineCustom(): void {
    previousValue = handle.getValue()
    previousSelected = handle.getSelectedValue()
    previousSeconds = config.customSeconds()
    pending = true
    committed = false
    handle.setValue(handle.getValue(), "Custom")
    showInlineEditor(true)
    if (inlineSpin !== null) {
      inlineSpin.set_value(previousSeconds)
      inlineSpin.grab_focus()
    }
  }

  function buildInlineEditor(): Gtk.Box {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      valign: Gtk.Align.CENTER,
    })
    box.add_css_class("field-custom-editor")
    box.add_css_class("field-inline-editor")
    box.visible = false

    const adjustment = new Gtk.Adjustment({
      lower: 1,
      upper: 3600,
      step_increment: 1,
      page_increment: 30,
      value: config.customSeconds(),
    })
    inlineSpin = new Gtk.SpinButton({ adjustment, digits: 0 })
    inlineSpin.add_css_class("field-custom-spin")
    inlineSpin.set_halign(Gtk.Align.START)
    inlineSpin.set_valign(Gtk.Align.CENTER)
    inlineSpin.set_width_chars(5)
    const spinKeys = new Gtk.EventControllerKey()
    spinKeys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    spinKeys.connect("key-pressed", (_controller, keyval) => inlineEditorKey(keyval))
    inlineSpin.add_controller(spinKeys)
    box.append(inlineSpin)

    const unit = new Gtk.Label({ label: "s" })
    unit.add_css_class("field-custom-unit")
    box.append(unit)

    inlineSetButton = new Gtk.Button({ label: "Set" })
    inlineSetButton.add_css_class("field-custom-set")
    inlineSetButton.connect("clicked", () => commitInlineCustom())
    box.append(inlineSetButton)

    return box
  }

  handle = dropdownField({
    key: config.key,
    description: config.description,
    options: config.options,
    value: config.value,
    selectedValue: config.selectedValue,
    accent: config.accent,
    presentation: config.presentation,
    popoverPosition: config.popoverPosition,
    onSelect: (value) => {
      if (value === "Custom") {
        if (detailed) beginInlineCustom()
        else config.onPreset(value)
        return
      }
      if (detailed) {
        pending = false
        showInlineEditor(false)
      }
      config.onPreset(value)
    },
    onOpen: () => {
      previousValue = handle.getValue()
      previousSelected = handle.getSelectedValue()
      previousSeconds = config.customSeconds()
      pending = handle.getSelectedValue() === "Custom"
      committed = false
      if (spin !== null) spin.set_value(previousSeconds)
      showEditor(pending)
      config.onOpen?.()
    },
    onClose: () => {
      // A close that did not choose/commit anything (Esc on the list,
      // click-outside) must leave the row agreeing with the unchanged trigger.
      if (!committed) controls?.setValue(handle.getValue(), previousSelected)
      pending = false
      committed = false
      showEditor(false)
      if (spin !== null) spin.set_value(config.customSeconds())
      config.onClose?.()
    },
    footer: {
      build: (footerControls) => {
        controls = footerControls
        editor = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          spacing: 6,
          valign: Gtk.Align.CENTER,
        })
        editor.add_css_class("field-custom-editor")
        editor.visible = false

        const adjustment = new Gtk.Adjustment({
          lower: 1,
          upper: 3600,
          step_increment: 1,
          page_increment: 30,
          value: config.customSeconds(),
        })
        spin = new Gtk.SpinButton({ adjustment, digits: 0 })
        spin.add_css_class("field-custom-spin")
        spin.set_halign(Gtk.Align.START)
        spin.set_valign(Gtk.Align.CENTER)
        spin.set_width_chars(5)
        // The popover controller also sees these keys, but the spin's internal
        // text child can consume Enter first on some GTK builds. A controller
        // on the spin itself keeps the editor contract deterministic.
        const spinKeys = new Gtk.EventControllerKey()
        spinKeys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
        spinKeys.connect("key-pressed", (_controller, keyval) => editorKey(keyval))
        spin.add_controller(spinKeys)
        editor.append(spin)

        const unit = new Gtk.Label({ label: "s" })
        unit.add_css_class("field-custom-unit")
        editor.append(unit)

        setButton = new Gtk.Button({ label: "Set" })
        setButton.add_css_class("field-custom-set")
        setButton.connect("clicked", () => commitCustom())
        editor.append(setButton)

        const hint = new Gtk.Label({
          label: "Enter sets the value · Esc restores the previous choice",
          halign: Gtk.Align.START,
        })
        hint.add_css_class("field-custom-hint")
        hint.visible = false

        const footer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 })
        footer.append(editor)
        footer.append(hint)

        // Keep the hint in step with the editor without a second state flag.
        editor.connect("notify::visible", () => {
          hint.visible = editorVisible()
        })

        return footer
      },
      onChoose: () => {
        committed = true
      },
      onActivate: (value) => {
        if (value !== "Custom") return false
        if (detailed) {
          beginInlineCustom()
          return true
        }
        pending = true
        controls?.setValue(handle.getValue(), "Custom")
        showEditor(true)
        if (spin !== null) {
          spin.set_value(config.customSeconds())
          spin.grab_focus()
        }
        return true
      },
      onKey: (keyval) => editorKey(keyval),
    },
  })

  // REQ-014: the detailed editor is a child of the SAME field root, next to the
  // inline group. It is built once and only shown/hidden; the compact footer
  // above is untouched. The bar grows only in detailed mode.
  inlineEditor = buildInlineEditor()
  ;(handle.root as Gtk.Box).append(inlineEditor)

  const baseSetValue = handle.setValue.bind(handle)
  const baseSetPresentation = handle.setPresentation.bind(handle)
  handle.setValue = (value: string, selectedValue?: string) => {
    baseSetValue(value, selectedValue)
    const selected = selectedValue ?? value
    if (selected !== "Custom") {
      pending = false
      showInlineEditor(false)
    } else if (detailed) {
      showInlineEditor(true)
    }
  }
  handle.setPresentation = (presentation: BarFieldPresentation) => {
    baseSetPresentation(presentation)
    detailed = presentation === "detailed"
    if (!detailed) {
      pending = false
      showInlineEditor(false)
      return
    }
    if (handle.getSelectedValue() === "Custom") showInlineEditor(true)
  }
  handle.isEditing = () => detailed && pending && inlineEditorFocused()

  if (detailed && handle.getSelectedValue() === "Custom") showInlineEditor(true)

  return handle
}
