// ---------------------------------------------------------------------------
// The capture side of the bar → capture recording-cluster request (SPIKE-003).
//
// The parsing/versioning belongs to `ags-platform/ports/capture-cluster`; this
// module only turns a validated request into a host call and maps host failures
// to the protocol's one-response shape.
//
// PURE: no `ags/*`, no `gi://*`, no I/O. The host is the GTK/controller seam,
// so every request path is testable without a desktop.
// ---------------------------------------------------------------------------

import {
  parseClusterRequest,
  type ClusterAnchor,
  type ClusterRequest,
  type ClusterResponse,
} from "ags-platform/ports/capture-cluster"

/** A host failure that carries the protocol error code, not just a message. */
export class ClusterHostError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = "ClusterHostError"
    this.code = code
    this.retryable = retryable
  }
}

export interface ClusterHost {
  show(request: ClusterRequest & { anchor: ClusterAnchor }): void
  update(request: ClusterRequest & { anchor: ClusterAnchor }): void
  hide(request: ClusterRequest): void
  popoverClose(): void
}

export type ClusterHandler = (text: string | undefined) => ClusterResponse

function terminal(error: string): ClusterResponse {
  return { ok: false, error, retryable: false }
}

/**
 * Build the handler for `argv[1]` of a `capture-cluster` request.
 *
 * A malformed request never reaches the host. A host exception never escapes;
 * expected host failures keep their code/retryability and everything else maps
 * to a retryable `internal`, because a transient GTK/monitor race should not
 * permanently disable the bar's next update.
 */
export function createClusterRequestHandler(host: ClusterHost): ClusterHandler {
  return (text) => {
    const parsed = parseClusterRequest(text)
    if (!parsed.ok) {
      console.error(`capture-tool: capture-cluster ${parsed.error}: ${parsed.detail}`)
      return terminal(parsed.error)
    }

    const request = parsed.request
    try {
      switch (request.command) {
        case "show":
        case "update": {
          // The validator guarantees this for these two commands; the guard
          // keeps the host contract honest if that ever changes.
          if (request.anchor === undefined) return terminal("bad-request")
          const anchored = request as ClusterRequest & { anchor: ClusterAnchor }
          if (request.command === "show") host.show(anchored)
          else host.update(anchored)
          break
        }
        case "hide":
          host.hide(request)
          break
        case "popover-close":
          host.popoverClose()
          break
      }
      return { ok: true }
    } catch (error) {
      if (error instanceof ClusterHostError) {
        console.error(
          `capture-tool: capture-cluster ${error.code}: ${error.message}`,
        )
        return { ok: false, error: error.code, retryable: error.retryable }
      }
      console.error(`capture-tool: capture-cluster internal: ${String(error)}`)
      return { ok: false, error: "internal", retryable: true }
    }
  }
}
