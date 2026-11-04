// ---------------------------------------------------------------------------
// The per-monitor `capture-overlay` surface (REQ-003, design.md §4/§11.2).
//
// SEPARATE FROM THE BAR, ON PURPOSE. gtk4-layer-shell has no input-region API,
// so a full-monitor TOP surface receives pointer everywhere. Keeping it in its
// own window (never `capture-window`) lets the bar stay OVERLAY/ON_DEMAND and
// remain clickable above the dim, while this file owns draw/move/resize,
// hover/pin and the monitor outline.
//
// CHROME IS CSS ONLY. Dim bands, the rect, its eight handles, the ring and the
// badge are ordinary GTK widgets styled by `style.css` from palette tokens.
// There is no Cairo paint surface, so a palette refresh is just the existing
// stylesheet reload (design.md §11.5).
//
// INPUT. Pointer coordinates are widget-local; adding the GDK monitor origin
// converts them to the global logical space shared by `hyprctl`, `slurp` and
// `grim`. Window hover/pin rects come from AstalHyprland clients via the
// controller; GTK4's absent global-pointer API is not used.
// ---------------------------------------------------------------------------

import { Astal, Gdk, Gtk } from "ags/gtk4"
import {
  HANDLE_ORDER,
  HANDLE_SIZE,
  badgeAnchor,
  clampRect,
  clientByAddress,
  globalToLocal,
  handlePositions,
  intersectRect,
  localToGlobal,
  monitorBadge,
  moveRect,
  rectFromPoints,
  regionBadge,
  regionPressAt,
  resizeRect,
  windowBadge,
  type Rect,
  type ResizeHandle,
} from "../../domain/selection"
import { appearanceRegistry } from "../appearance"
import type {
  OverlayHost,
  OverlayView,
  SelectionController,
} from "./controller"

const OVERLAY_NAME = "capture-overlay"
const CHROME_INSET = 12

function monitorGeometry(monitor: Gdk.Monitor): Rect {
  const rect = monitor.get_geometry()
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

function nonInteractive(widget: Gtk.Widget): void {
  widget.set_can_target(false)
}

function box(cssClass: string): Gtk.Box {
  const widget = new Gtk.Box()
  widget.add_css_class(cssClass)
  nonInteractive(widget)
  return widget
}

export function SelectionOverlay(
  gdkmonitor: Gdk.Monitor,
  controller: SelectionController,
): Astal.Window {
  const geometry = monitorGeometry(gdkmonitor)
  const connector = gdkmonitor.get_connector() ?? ""
  let overlayWindow: Astal.Window | null = null
  let root: Gtk.Box | null = null
  let fixed: Gtk.Fixed | null = null
  let dim: Gtk.Box | null = null
  let outline: Gtk.Box | null = null
  let ring: Gtk.Box | null = null
  let rect: Gtk.Box | null = null
  const handles = new Map<ResizeHandle, Gtk.Box>()
  let badge: Gtk.Label | null = null
  let unregisterAppearance: (() => void) | null = null
  let current: OverlayView | null = null
  let pointerDown = false
  let drag:
    | { kind: "draw" | "move" | "resize"; handle?: ResizeHandle; start: { x: number; y: number }; origin: Rect }
    | null = null

  function toGlobal(localX: number, localY: number): { x: number; y: number } {
    return localToGlobal(localX, localY, geometry)
  }

  function toLocal(globalX: number, globalY: number): { x: number; y: number } {
    return globalToLocal(globalX, globalY, geometry)
  }

  function show(widget: Gtk.Widget | null, visible: boolean): void {
    if (widget) widget.visible = visible
  }

  function place(widget: Gtk.Widget | null, target: Rect, visible = true): void {
    if (!fixed || !widget) return
    const local = toLocal(target.x, target.y)
    widget.set_size_request(Math.max(1, target.width), Math.max(1, target.height))
    fixed.move(widget, local.x, local.y)
    widget.visible = visible
  }

  function placeHandles(target: Rect): void {
    if (!fixed) return
    const visible = new Set<ResizeHandle>()
    for (const position of handlePositions(target)) {
      const handle = handles.get(position.handle)
      if (!handle) continue
      const local = toLocal(position.x, position.y)
      handle.set_size_request(HANDLE_SIZE, HANDLE_SIZE)
      fixed.move(handle, local.x, local.y)
      handle.visible = true
      visible.add(position.handle)
    }
    for (const handle of HANDLE_ORDER) {
      if (!visible.has(handle)) show(handles.get(handle) ?? null, false)
    }
  }

  function placeBadge(text: string, anchor: Rect | null): void {
    if (!fixed || !badge) return
    badge.set_label(text)
    badge.visible = true
    const [, naturalWidth] = badge.measure(Gtk.Orientation.HORIZONTAL, -1)
    const width = Math.max(120, naturalWidth)
    const [, naturalHeight] = badge.measure(Gtk.Orientation.VERTICAL, width)
    const height = Math.max(24, naturalHeight)
    const target = anchor ?? {
      x: geometry.x + CHROME_INSET,
      y: geometry.y + CHROME_INSET,
      width: 1,
      height: 1,
    }
    const at = badgeAnchor(target, geometry, width, height)
    const local = toLocal(at.x, at.y)
    fixed.move(badge, local.x, local.y)
  }

  function hideChrome(): void {
    show(outline, false)
    show(ring, false)
    show(rect, false)
    show(badge, false)
    for (const handle of handles.values()) handle.visible = false
  }

  function render(view: OverlayView): void {
    current = view
    // The overlay's ONLY lane signal is `OverlayView.mode`; one class scopes
    // ring/rect/handles/badge/outline to the recording token. The dim class is
    // deliberately not touched: it stays neutral in both lanes.
    if (root) {
      if (view.mode === "recording") root.add_css_class("recording")
      else root.remove_css_class("recording")
    }
    const visible =
      view.active && (view.target !== "region" || connector === view.focused)
    if (overlayWindow) overlayWindow.visible = visible
    if (!visible || !fixed) return

    hideChrome()
    show(dim, true)
    if (dim) {
      dim.set_size_request(geometry.width, geometry.height)
      fixed.move(dim, 0, 0)
    }

    if (view.target === "region") {
      const pending = view.pending
      const region = pending.target === "region" ? pending.rect : null
      if (region !== null) {
        place(rect, region)
        placeHandles(region)
      }
      placeBadge(regionBadge(region), region)
      return
    }

    if (view.target === "screen") {
      const selected =
        view.pending.target === "screen"
          ? (view.pending.monitor ?? view.focused)
          : view.focused
      if (outline) {
        outline.set_size_request(
          Math.max(1, geometry.width - CHROME_INSET * 2),
          Math.max(1, geometry.height - CHROME_INSET * 2),
        )
        fixed.move(outline, CHROME_INSET, CHROME_INSET)
        outline.visible = true
        if (connector === selected) outline.add_css_class("selected")
        else outline.remove_css_class("selected")
      }
      if (connector === selected) {
        placeBadge(
          monitorBadge(
            Math.max(1, view.monitorIndex),
            geometry.width,
            geometry.height,
          ),
          {
            x: geometry.x + CHROME_INSET,
            y: geometry.y + CHROME_INSET,
            width: geometry.width - CHROME_INSET * 2,
            height: geometry.height - CHROME_INSET * 2,
          },
        )
      }
      return
    }

    if (view.target !== "window") return

    // Window: the ring follows the hovered client, or stays on the pin. A
    // client is drawn only by the overlay of the monitor it intersects.
    const hovered = clientByAddress(view.clients, view.hoverAddress)
    const client = view.pinned ?? hovered
    if (client !== null) {
      const clipped = intersectRect(client.rect, geometry)
      if (clipped !== null) {
        place(ring, clipped)
        placeBadge(windowBadge(client, view.pinned !== null), clipped)
        return
      }
    }
    placeBadge(windowBadge(null, false), null)
  }

  function beginRegionDrag(globalX: number, globalY: number): void {
    if (current === null || current.target !== "region") return
    const pending = current.pending
    const existing = pending.target === "region" ? pending.rect : null
    if (existing !== null) {
      const press = regionPressAt(existing, globalX, globalY)
      if (press !== null) {
        drag =
          press.kind === "resize"
            ? {
                kind: "resize",
                handle: press.handle,
                start: { x: globalX, y: globalY },
                origin: existing,
              }
            : { kind: "move", start: { x: globalX, y: globalY }, origin: existing }
        return
      }
    }
    drag = {
      kind: "draw",
      start: { x: globalX, y: globalY },
      origin: rectFromPoints(globalX, globalY, globalX, globalY),
    }
  }

  function updateRegionDrag(globalX: number, globalY: number): void {
    if (drag === null) return
    const dx = globalX - drag.start.x
    const dy = globalY - drag.start.y
    if (drag.kind === "draw") {
      controller.setRect(
        clampRect(rectFromPoints(drag.start.x, drag.start.y, globalX, globalY), geometry),
      )
      return
    }
    if (drag.kind === "move") {
      controller.setRect(moveRect(drag.origin, dx, dy, geometry))
      return
    }
    controller.setRect(resizeRect(drag.origin, drag.handle ?? "se", dx, dy, geometry))
  }

  function endRegionDrag(): void {
    if (drag === null) return
    const kind = drag.kind
    drag = null
    if (kind !== "draw") return
    const pending = current?.pending
    const finished = pending?.target === "region" ? pending.rect : null
    // A click/short twitch is not a selection; releasing never captures.
    if (finished !== null && (finished.width < 4 || finished.height < 4)) {
      controller.setRect(null)
    }
  }

  function wireInput(widget: Gtk.Widget): void {
    const click = new Gtk.GestureClick({ button: Gdk.BUTTON_PRIMARY })
    click.connect("pressed", (_gesture, _n, x, y) => {
      pointerDown = true
      const global = toGlobal(x, y)
      if (current?.target === "region") beginRegionDrag(global.x, global.y)
    })
    click.connect("released", (_gesture, _n, x, y) => {
      pointerDown = false
      const global = toGlobal(x, y)
      if (current === null) return
      if (current.target === "region") {
        endRegionDrag()
      } else if (current.target === "window") {
        controller.pinAt(global.x, global.y)
      } else if (connector !== "") {
        controller.selectMonitor(connector)
      }
    })
    widget.add_controller(click)

    const motion = new Gtk.EventControllerMotion()
    motion.connect("motion", (_controller, x, y) => {
      const global = toGlobal(x, y)
      if (pointerDown && current?.target === "region") {
        updateRegionDrag(global.x, global.y)
      } else if (!pointerDown && current?.target === "window") {
        controller.hoverAt(global.x, global.y)
      }
    })
    motion.connect("leave", () => {
      if (!pointerDown) controller.leave()
    })
    widget.add_controller(motion)
  }

  function build(widget: Gtk.Box): void {
    root = widget
    widget.set_hexpand(true)
    widget.set_vexpand(true)
    widget.set_halign(Gtk.Align.FILL)
    widget.set_valign(Gtk.Align.FILL)
    wireInput(widget)

    const canvas = new Gtk.Fixed()
    canvas.add_css_class("overlay-canvas")
    canvas.set_hexpand(true)
    canvas.set_vexpand(true)
    nonInteractive(canvas)
    widget.append(canvas)
    fixed = canvas

    dim = box("overlay-dim")
    canvas.put(dim, 0, 0)

    outline = box("mon-outline")
    canvas.put(outline, CHROME_INSET, CHROME_INSET)

    ring = box("selring")
    canvas.put(ring, 0, 0)

    rect = box("selrect")
    canvas.put(rect, 0, 0)

    for (const handle of HANDLE_ORDER) {
      const square = box("selhandle")
      // The mockup's handle selector is `.hx`; keep it as a compatibility
      // class on the same 9px circle.
      square.add_css_class("hx")
      canvas.put(square, 0, 0)
      handles.set(handle, square)
    }

    badge = new Gtk.Label({ label: "" })
    badge.add_css_class("selbadge")
    badge.set_halign(Gtk.Align.START)
    badge.set_valign(Gtk.Align.START)
    nonInteractive(badge)
    canvas.put(badge, 0, 0)

    hideChrome()
    show(dim, false)
  }

  return (
    <window
      visible={false}
      name={OVERLAY_NAME}
      class="capture-overlay"
      namespace="capture"
      gdkmonitor={gdkmonitor}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      layer={Astal.Layer.TOP}
      // A full-monitor pointer surface must never reserve a compositor zone,
      // and keymode NONE keeps Enter/Esc owned by the bar (design.md §11.2).
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      margin_top={0}
      margin_bottom={0}
      margin_left={0}
      margin_right={0}
      $={(self) => {
        overlayWindow = self
        const host: OverlayHost = {
          connector,
          geometry,
          setVisible: (visible: boolean) => {
            self.visible = visible
          },
          render,
        }
        // Palette refresh surface: CSS is reloaded globally, and this callback
        // merely re-renders the SAME pending state (INV-4). It never changes
        // the session, the rect or the pin.
        unregisterAppearance = appearanceRegistry.register({
          clearCaches: () => {},
          rebuildIcons: () => {},
          refreshWindow: () => controller.refresh(),
        })
        controller.register(host)
        self.connect("destroy", () => {
          controller.unregister(host)
          if (unregisterAppearance !== null) {
            unregisterAppearance()
            unregisterAppearance = null
          }
        })
      }}
    >
      <box class="overlay-root" $={build} />
    </window>
  ) as unknown as Astal.Window
}
