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
import type { FieldOptionDef } from "./field-defs"

export interface DropdownFieldConfig {
  /** Uppercase trigger key and popover title, from the design contract. */
  key: string
  /** One-line popover purpose, from the design contract. */
  description: string
  options: readonly FieldOptionDef[]
  /** Active contract value (for example `Region`, `3s`, a connector name). */
  value: string
  /** Show the selected option's icon beside the key (Target and Monitor). */
  lead?: boolean
  /** Popover direction; bottom bars open TOP, top bars open BOTTOM. */
  popoverPosition?: () => Gtk.PositionType
  onSelect: (value: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface DropdownFieldHandle {
  /** The field widget the page appends to its row. */
  root: Gtk.Widget
  setValue: (value: string) => void
  setOptions: (options: readonly FieldOptionDef[]) => void
  setEnabled: (enabled: boolean) => void
  setVisible: (visible: boolean) => void
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
  let currentOptions: readonly FieldOptionDef[] = config.options
  let restoreFocus = false

  const root = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
  root.add_css_class("field")

  const trigger = new Gtk.MenuButton()
  trigger.add_css_class("field-trigger")
  trigger.set_always_show_arrow(false)
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

  const popover = new Gtk.Popover()
  popover.add_css_class("field-popover")
  popover.set_has_arrow(true)
  popover.set_autohide(true)
  popover.set_position(
    config.popoverPosition === undefined ? Gtk.PositionType.TOP : config.popoverPosition(),
  )
  trigger.set_popover(popover)

  const body = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  popover.set_child(body)

  const header = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
  header.add_css_class("field-pop-header")
  const title = new Gtk.Label({ label: config.key, halign: Gtk.Align.START })
  title.add_css_class("field-pop-title")
  const description = new Gtk.Label({ label: config.description, halign: Gtk.Align.START })
  description.add_css_class("field-pop-desc")
  header.append(title)
  header.append(description)
  body.append(header)

  const list = new Gtk.ListBox()
  list.add_css_class("field-list")
  list.set_selection_mode(Gtk.SelectionMode.SINGLE)
  list.set_activate_on_single_click(true)
  body.append(list)

  let rows: Array<{ option: FieldOptionDef; row: Gtk.ListBoxRow }> = []

  function displayValue(value: string): string {
    const option = currentOptions.find((entry) => entry.value === value)
    return option === undefined ? value : option.label
  }

  function selectedOption(): FieldOptionDef | null {
    return currentOptions.find((entry) => entry.value === currentValue) ?? null
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
      if (entry.option.value === currentValue) entry.row.add_css_class("field-selected")
      else entry.row.remove_css_class("field-selected")
    }
    const selected = rows.find((entry) => entry.option.value === currentValue)
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
    markSelected()
    syncLead()
  }

  function applyValue(value: string): void {
    currentValue = value
    valueLabel.set_label(displayValue(value))
    markSelected()
    syncLead()
  }

  function isOpen(): boolean {
    return popover.get_visible()
  }

  function close(): void {
    if (!isOpen()) return
    trigger.popdown()
  }

  function choose(value: string): void {
    applyValue(value)
    restoreFocus = true
    close()
    config.onSelect(value)
  }

  function open(): void {
    if (!trigger.get_sensitive() || !root.get_visible()) return
    popover.set_position(
      config.popoverPosition === undefined ? Gtk.PositionType.TOP : config.popoverPosition(),
    )
    trigger.popup()
  }

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
  })

  popover.connect("closed", () => {
    openNotified = false
    root.remove_css_class("field-open")
    chevron.set_from_icon_name("pan-down-symbolic")
    const shouldRestore = restoreFocus
    restoreFocus = false
    config.onClose?.()
    if (shouldRestore) trigger.grab_focus()
  })

  rebuildRows()

  return {
    root,
    setValue(value: string): void {
      applyValue(value)
    },
    setOptions(options: readonly FieldOptionDef[]): void {
      currentOptions = options
      rebuildRows()
    },
    setEnabled(enabled: boolean): void {
      trigger.set_sensitive(enabled)
      if (!enabled) close()
    },
    setVisible(visible: boolean): void {
      root.set_visible(visible)
      if (!visible) close()
    },
    open,
    close,
    isOpen,
    destroy(): void {
      close()
      root.set_visible(false)
    },
  }
}
