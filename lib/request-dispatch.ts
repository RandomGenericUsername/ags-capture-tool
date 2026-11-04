// ---------------------------------------------------------------------------
// The capture app's request dispatcher (SPIKE-003).
//
// `palette-refresh` is the existing live-refresh contract and routes to the
// existing helper unchanged. `capture-cluster` is the AGS request channel the
// bar uses to ask this process to draw its recording cluster. Any other
// argv[0] gets one JSON error instead of the helper's text ack.
//
// PURE: no `ags/*`, no `gi://*`, no I/O.
// ---------------------------------------------------------------------------

import {
  CAPTURE_CLUSTER_COMMAND,
  encodeClusterResponse,
  type ClusterResponse,
} from "ags-platform/ports/capture-cluster"
import {
  PALETTE_REFRESH_COMMAND,
  type PaletteRefreshRequestHandler,
} from "ags-platform/ports/palette-refresh"
import type { ClusterHandler } from "./cluster-request"

export type CaptureRequestHandler = (
  argv: readonly string[],
  respond: (response: string) => void,
) => void

function terminal(error: string, retryable: boolean): ClusterResponse {
  return { ok: false, error, retryable }
}

export function createCaptureRequestHandler(
  paletteRefresh: PaletteRefreshRequestHandler,
  cluster: ClusterHandler,
): CaptureRequestHandler {
  return (argv, respond) => {
    const command = argv[0]

    if (command === PALETTE_REFRESH_COMMAND) {
      paletteRefresh(argv, respond)
      return
    }

    if (command === CAPTURE_CLUSTER_COMMAND) {
      try {
        respond(encodeClusterResponse(cluster(argv[1])))
      } catch (error) {
        // The cluster handler owns host failures. This is the last-resort
        // exactly-one-response guard for a programming error in that path.
        console.error(`capture-tool: capture-cluster dispatcher: ${String(error)}`)
        respond(encodeClusterResponse(terminal("internal", true)))
      }
      return
    }

    respond(encodeClusterResponse(terminal("unknown-command", false)))
  }
}
