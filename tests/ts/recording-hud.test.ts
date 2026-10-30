// ---------------------------------------------------------------------------
// S4 HUD state machine (REQ-004, design.md §3/§5/§11.7).
//
// Pure transitions executed under Node: running -> paused -> running -> idle,
// timer formatting, pause continuity (the backend excludes paused spans), and
// the idempotent/order-tolerant handling of duplicate and out-of-order
// `capture.state` snapshots. `bar_compact_controls` placement is pinned here
// too because it is a pure decision.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  elapsedAt,
  formatElapsed,
  hudControlPlacement,
  hudTimer,
  idleHud,
  isHudLive,
  pauseAction,
  pauseLabel,
  reduceCaptureState,
  stoppedHud,
  type RecordingHudState,
} from "../../domain/recording-hud.ts"

function recording(elapsed: number, job = "job-1") {
  return { state: "recording", elapsed_seconds: elapsed, job_id: job }
}

function paused(elapsed: number, job = "job-1") {
  return { state: "paused", elapsed_seconds: elapsed, job_id: job }
}

test("formatElapsed is MM:SS and never invents a value from bad input", () => {
  assert.equal(formatElapsed(0), "00:00")
  assert.equal(formatElapsed(5), "00:05")
  assert.equal(formatElapsed(65), "01:05")
  assert.equal(formatElapsed(3599), "59:59")
  assert.equal(formatElapsed(3600), "60:00")
  assert.equal(formatElapsed(-4), "00:00")
  assert.equal(formatElapsed(Number.NaN), "00:00")
  assert.equal(formatElapsed(Number.POSITIVE_INFINITY), "00:00")
})

test("the first recording snapshot opens the HUD with its job id", () => {
  const state = reduceCaptureState(idleHud(), recording(3), 1_000)
  assert.equal(state.phase, "recording")
  assert.equal(state.elapsedSeconds, 3)
  assert.equal(state.jobId, "job-1")
  assert.equal(isHudLive(state), true)
  assert.equal(hudTimer(state, 1_000), "00:03")
})

test("a running timer interpolates between pushes", () => {
  const state = reduceCaptureState(idleHud(), recording(3), 1_000)
  assert.equal(elapsedAt(state, 1_000), 3)
  assert.equal(elapsedAt(state, 4_500), 6, "3s pushed + 3 whole seconds elapsed")
  assert.equal(hudTimer(state, 4_500), "00:06")
})

test("pause freezes the timer: paused spans never advance it", () => {
  const running = reduceCaptureState(idleHud(), recording(8), 1_000)
  const pausedState = reduceCaptureState(running, paused(8), 5_000)

  assert.equal(pausedState.phase, "paused")
  assert.equal(hudTimer(pausedState, 5_000), "00:08")
  // 30 seconds later it is still 00:08: the backend's elapsed is recorded time.
  assert.equal(hudTimer(pausedState, 35_000), "00:08")
})

test("resume continues from the paused value instead of restarting", () => {
  const pausedState = reduceCaptureState(
    reduceCaptureState(idleHud(), recording(8), 1_000),
    paused(8),
    5_000,
  )
  const resumed = reduceCaptureState(pausedState, recording(8), 35_000)
  assert.equal(resumed.phase, "recording")
  assert.equal(hudTimer(resumed, 35_000), "00:08")
  assert.equal(hudTimer(resumed, 40_000), "00:13", "only the new segment advances")
})

test("a duplicate snapshot is idempotent", () => {
  const once = reduceCaptureState(idleHud(), paused(11), 2_000)
  const twice = reduceCaptureState(once, paused(11), 9_000)
  assert.equal(twice.phase, "paused")
  assert.equal(twice.elapsedSeconds, 11)
  assert.equal(twice.jobId, "job-1")
  assert.equal(hudTimer(twice, 60_000), "00:11")
})

test("an out-of-order older snapshot cannot undo a newer pause", () => {
  const pausedState = reduceCaptureState(
    reduceCaptureState(idleHud(), recording(10), 1_000),
    paused(10),
    2_000,
  )
  const stale = reduceCaptureState(pausedState, recording(7), 3_000)
  assert.equal(stale, pausedState, "a lower same-job elapsed is stale and ignored")
  assert.equal(stale.phase, "paused")
})

test("an out-of-order older pause cannot regress a running timer", () => {
  const running = reduceCaptureState(idleHud(), recording(12), 5_000)
  const stale = reduceCaptureState(running, paused(9), 6_000)
  assert.equal(stale, running)
  assert.equal(stale.phase, "recording")
})

test("idle (stop/failure/cancel) closes the HUD and blocks that job's replay", () => {
  const running = reduceCaptureState(idleHud(), recording(20), 1_000)
  const stopped = reduceCaptureState(
    running,
    { state: "idle", elapsed_seconds: 20, job_id: "job-1" },
    3_000,
  )
  assert.equal(stopped.phase, "idle")
  assert.equal(isHudLive(stopped), false)
  assert.equal(stopped.jobId, null)
  assert.equal(stopped.endedJobId, "job-1")

  const replay = reduceCaptureState(stopped, recording(21), 4_000)
  assert.equal(replay, stopped, "a replayed snapshot from the ended job is ignored")
})

test("a newer job is accepted after the previous one ended", () => {
  const stopped = reduceCaptureState(
    reduceCaptureState(idleHud(), recording(4), 1_000),
    { state: "idle" },
    2_000,
  )
  const next = reduceCaptureState(stopped, recording(1, "job-2"), 3_000)
  assert.equal(next.phase, "recording")
  assert.equal(next.jobId, "job-2")
  assert.equal(next.elapsedSeconds, 1)
})

test("an unknown state is terminal, so the HUD cannot stick", () => {
  const running = reduceCaptureState(idleHud(), recording(4), 1_000)
  const closed = reduceCaptureState(running, { state: "cancelled" }, 2_000)
  assert.equal(closed.phase, "idle")
})

test("stoppedHud closes immediately and remembers the job", () => {
  const running = reduceCaptureState(idleHud(), recording(17), 1_000)
  const stopped = stoppedHud(running, 2_000)
  assert.equal(stopped.phase, "idle")
  assert.equal(stopped.jobId, null)
  assert.equal(stopped.endedJobId, "job-1")
  assert.equal(stopped.elapsedSeconds, 17)
})

test("bar_compact_controls decides who carries Pause/Stop", () => {
  assert.deepEqual(hudControlPlacement(false), { barControls: true, popup: false })
  assert.deepEqual(hudControlPlacement(true), { barControls: false, popup: true })
})

test("pause copy/action flip together while paused", () => {
  const running = reduceCaptureState(idleHud(), recording(1), 1_000)
  const pausedState = reduceCaptureState(running, paused(1), 2_000)
  assert.equal(pauseLabel(running), "Pause")
  assert.equal(pauseAction(running), "pause")
  assert.equal(pauseLabel(pausedState), "Resume")
  assert.equal(pauseAction(pausedState), "resume")
})

test("a recording snapshot without a job id keeps the known job", () => {
  const withJob = reduceCaptureState(idleHud(), recording(2), 1_000)
  const noJob: RecordingHudState = reduceCaptureState(
    withJob,
    { state: "recording", elapsed_seconds: 3 },
    2_000,
  )
  assert.equal(noJob.jobId, "job-1")
  assert.equal(noJob.elapsedSeconds, 3)
})
