import { Gtk } from "ags/gtk4"
// The platform's registry-backed IconProvider (spine AD-4/AD-7) replaces the
// app-local lib/icon-registry.ts copy: the same rendered-icon pipeline the bar
// and hypr-pano consume, so a palette change restyles this window too. The
// provider answers with a tagged `IconSource` — a rendered `file` or a symbolic
// `name` (AD-18); only a file is usable here.
import { registryProvider } from "ags-platform/adapters/icon"

// ---------------------------------------------------------------------------
// Icons: resolved through the platform icon provider. Every button keeps its
// text label, so a missing manifest/render degrades to text — never a crash.
//
// LIVE-PALETTE REFRESH (AD-27). The generated capture icons are palette-
// tinted SVG files under `$XDG_STATE_HOME/dotfiles/current/icons`; the runtime
// regenerates them on a palette change. A `Gtk.Image` built from the old file
// keeps the old palette rendering, so each icon-bearing box records a slot
// that can be cleared and rebuilt in place. `IconSlots` is per-window state:
// the window registers `clear` + `refresh` with its appearance surface, and
// the app-level registry fans a palette refresh out to every live window.
//
// Only the image child is replaced. The label, the box, its handlers and the
// surrounding widget tree stay the same object, which is what keeps the active
// surface and focus alive across a refresh.
// ---------------------------------------------------------------------------

// Frozen `capture-tool` icon variants (design.md §1).
export type IconVariant =
  | "camera"
  | "video"
  | "region"
  | "monitor"
  | "window"
  | "clipboard"
  | "save"
  | "speaker"
  | "mic"
  | "info"

/** One icon-bearing box: the image it currently holds, and how to rebuild it. */
export interface IconSlot {
  /** Remove the current image child, leaving the label as the fallback. */
  clear(): void
  /** Clear, then resolve and prepend a fresh image for the new palette. */
  refresh(): void
}

/** The per-window set of icon slots used by its appearance surface. */
export interface IconSlots {
  add(slot: IconSlot): void
  clear(): void
  refresh(): void
}

export function createIconSlots(): IconSlots {
  const slots: IconSlot[] = []
  return {
    add(slot: IconSlot): void {
      slots.push(slot)
    },
    clear(): void {
      for (const slot of slots) slot.clear()
    },
    refresh(): void {
      for (const slot of slots) slot.refresh()
    },
  }
}

export function captureIcon(variant: IconVariant, size: number): Gtk.Widget | null {
  // The provider returns an `IconSource`; a symbolic `name` (bare desktop, no
  // rendered art) has no path to load here, so it falls back to the text label.
  const source = registryProvider.resolve("capture-tool", variant)
  const path = source !== null && source.kind === "file" ? source.path : null
  if (path === null) return null
  try {
    // Gtk.Image + pixel_size (bar precedent): forces the SVG to render at
    // exactly `size` px. Gtk.Picture + set_size_request is NOT equivalent —
    // the request is only a minimum and the 1024px SVG natural size still
    // drives measurement, inflating every tile to screen scale.
    const image = Gtk.Image.new_from_file(path)
    image.set_pixel_size(size)
    image.set_halign(Gtk.Align.CENTER)
    image.set_valign(Gtk.Align.CENTER)
    return image
  } catch (error) {
    console.error(`capture-tool: cannot load icon ${path}: ${error}`)
    return null
  }
}

/**
 * Prepend the resolved icon to a button-content box (label stays as fallback)
 * and register the slot for live palette refreshes.
 */
export function withIcon(variant: IconVariant, size: number, slots: IconSlots) {
  return (self: Gtk.Box) => {
    let current: Gtk.Widget | null = null

    const clear = () => {
      if (current === null) return
      self.remove(current)
      current = null
    }

    const refresh = () => {
      clear()
      const icon = captureIcon(variant, size)
      if (icon !== null) {
        self.prepend(icon)
        current = icon
      }
    }

    refresh()
    slots.add({ clear, refresh })
  }
}
