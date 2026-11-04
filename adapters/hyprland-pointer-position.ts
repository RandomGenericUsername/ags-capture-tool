// ---------------------------------------------------------------------------
// ADAPTER: global pointer position from Hyprland (REQ-006, SPIKE-001 C).
//
// WHY THE COMPOSITOR: GTK4 removed global pointer tracking, and a mapped GTK
// surface is the only other source — but mapped pixels receive clicks too, so
// option A's hit area is not acceptable. The compositor already knows where the
// pointer is and answers without mapping anything.
//
// PRIMARY: the Hyprland command socket
//   $XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket.sock
// queried with `j/cursorpos`. The spike measured ~0.009 ms per direct socket
// query; spawning `hyprctl` at 20 Hz costs ~7% of a core, so the socket is the
// preferred path. One `Gio.SocketClient` is reused; the connection itself is
// per query because Hyprland closes the command socket after one request
// (measured: a second write on the same connection gets EPIPE).
//
// FALLBACK: `hyprctl -j cursorpos` via a synchronous spawn, for a host where
// the socket path is unavailable but the CLI works. This is the same
// "sync spawn on a non-hot path" pattern as `hyprland-monitor-reserved.ts`;
// here it only runs when the socket already failed.
//
// FAILURE: every path returns null and never throws. A missing Hyprland, a
// stale signature, a socket that refuses the query and a malformed reply all
// mean "pointer unknown"; the pure reveal rule then keeps the HUD hidden.
// ---------------------------------------------------------------------------

import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"
import { parseCursorPosition, type PointerPoint } from "../domain/pointer-position"
import type { PointerPosition } from "../ports/pointer-position"

/** One request/response over a fresh connection to the command socket. */
function querySocket(client: Gio.SocketClient, path: string): string | null {
  let connection: Gio.SocketConnection | null = null
  try {
    connection = client.connect(Gio.UnixSocketAddress.new(path), null)
    // A compositor that accepts the connection but never answers must not
    // block the main loop forever. One second is far above the measured
    // sub-millisecond reply and only matters on failure.
    connection.get_socket().set_timeout(1)
    const output = connection.get_output_stream()
    output.write_all("j/cursorpos", null)
    const input = connection.get_input_stream()
    const [ok, data] = input.read_all(null)
    if (!ok || data.length === 0) return null
    return new TextDecoder().decode(data)
  } catch {
    return null
  } finally {
    try {
      connection?.close(null)
    } catch {
      // Already closed by the peer; nothing to unwind.
    }
  }
}

/** `hyprctl -j cursorpos`, used only when the socket path cannot answer. */
function queryHyprctl(): string | null {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync("hyprctl -j cursorpos")
    if (!ok || stdout === null) return null
    return new TextDecoder().decode(stdout)
  } catch {
    return null
  }
}

function socketPath(): string | null {
  const signature = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")
  if (signature === null || signature === "") return null
  const runtime = GLib.getenv("XDG_RUNTIME_DIR") ?? GLib.get_user_runtime_dir()
  if (runtime === null || runtime === "") return null
  return `${runtime}/hypr/${signature}/.socket.sock`
}

export function hyprlandPointerPosition(): PointerPosition {
  // The client is the persistent part: creating it once avoids per-poll setup.
  const client = new Gio.SocketClient()
  client.set_timeout(1)
  let reportedFailure = false

  function reportOnce(): void {
    if (reportedFailure) return
    reportedFailure = true
    console.error(
      "capture-tool: no Hyprland pointer source; hover reveal is disabled",
    )
  }

  return {
    current(): PointerPoint | null {
      const path = socketPath()
      if (path !== null) {
        const parsed = parseCursorPosition(querySocket(client, path) ?? "")
        if (parsed !== null) return parsed
      }
      const fallback = parseCursorPosition(queryHyprctl() ?? "")
      if (fallback !== null) return fallback
      reportOnce()
      return null
    },
  }
}
