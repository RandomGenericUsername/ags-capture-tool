// ---------------------------------------------------------------------------
// Direct unit tests for `domain/ui-state.ts` (workstream A4, tasks 4.4–4.7).
//
// This module holds the two vocabularies the GUI and the backend disagree about,
// which is exactly why it was worth extracting and exactly why it needs direct
// tests:
//
//   * the UI says `microphone`, the config says `mic`, the CLI wants `mic`;
//   * the UI says `75%`, the CLI wants `75`.
//
// Both are silent failures: nothing throws, the panel just stops honouring the
// user's choice, or the backend argparse rejects the flag. `GIF_SIZE_ARG` below
// is the drift trap this workstream exists to kill — the bare numbers are
// asserted, not just the mapping.
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ConfigRecordingAudio } from "../../domain/settings.ts"
import {
  AUDIO_SOURCES,
  DEFAULT_RECORDING,
  DEFAULT_SCREENSHOT,
  GIF_SIZES,
  GIF_SIZE_ARG,
  audioToUi,
  createUiState,
  durationSelection,
  isGif,
  mergeUiState,
  oneOf,
  type PersistedUiState,
  type UiState,
} from "../../domain/ui-state.ts"

// A base with every field off its code default, so a test that asserts a
// fallback came from the BASE proves `mergeUiState` honours its argument rather
// than agreeing with the hardcoded constant by coincidence. REQ-012 removed the
// settings-derived base; the merge itself still takes any `UiState` base.
const CUSTOM_BASE: UiState = {
  screenshot: { target: "window", delay: 5, format: "jpeg", save: true },
  recording: {
    target: "screen",
    fps: 24,
    format: "gif",
    audio: "microphone",
    quality: "low",
    duration: 0,
    gifFps: 20,
    size: "50%",
    customDuration: 120,
  },
}

// ---------------------------------------------------------------------------
// audioToUi — task 4.6
// ---------------------------------------------------------------------------

test("audioToUi: config mic becomes the UI word microphone", () => {
  assert.equal(audioToUi("mic"), "microphone")
})

test("audioToUi: none and system pass straight through", () => {
  assert.equal(audioToUi("none"), "none")
  assert.equal(audioToUi("system"), "system")
})

test("audioToUi: the two vocabularies are exactly these words", () => {
  // The mapping is total over the config union, and its image is the UI union.
  // Anything else is a typo the types would have caught but a config file on
  // disk would not.
  assert.deepEqual([...AUDIO_SOURCES].sort(), ["microphone", "none", "system"])
  // Typed at the union because these three words ARE the config union; the
  // mapping's totality is the property being asserted.
  const configVocabulary: ConfigRecordingAudio[] = ["none", "system", "mic"]
  assert.deepEqual(configVocabulary.map(audioToUi).sort(), ["microphone", "none", "system"])
})

// ---------------------------------------------------------------------------
// GIF_SIZE_ARG — task 4.7, THE DRIFT TRAP
// ---------------------------------------------------------------------------

test("GIF_SIZE_ARG: the UI percentages become bare numbers on the wire", () => {
  // bin/capture-tool's argparse accepts --size {original,75,50} and rejects
  // anything else. "75%" would not error in the GUI — it would fail in the
  // child process, after the user had already pressed record.
  assert.equal(GIF_SIZE_ARG["original"], "original")
  assert.equal(GIF_SIZE_ARG["75%"], "75")
  assert.equal(GIF_SIZE_ARG["50%"], "50")
})

test("GIF_SIZE_ARG: no emitted value carries a percent sign", () => {
  // Stated as a property over the whole table rather than per key, so ADDING a
  // scale later cannot smuggle "90%" past three hand-written assertions.
  for (const [ui, arg] of Object.entries(GIF_SIZE_ARG)) {
    assert.ok(!arg.includes("%"), `${JSON.stringify(ui)} -> ${arg} still contains %`)
  }
  assert.deepEqual(Object.values(GIF_SIZE_ARG), ["original", "75", "50"])
})

test("GIF_SIZE_ARG: the table is keyed by every UI scale and nothing else", () => {
  assert.deepEqual(Object.keys(GIF_SIZE_ARG).sort(), [...GIF_SIZES].sort())
  assert.deepEqual([...GIF_SIZES], ["original", "75%", "50%"])
})

// ---------------------------------------------------------------------------
// First run — REQ-012: code constants, never settings defaults
// ---------------------------------------------------------------------------

test("first run: mergeUiState over createUiState() is exactly the code defaults", () => {
  // A missing capture-ui.json makes the adapter call `mergeUiState(base, {})`.
  // With REQ-012 the base is `createUiState()`, so the lane starts from code
  // constants regardless of what legacy settings.json still contains.
  const ui = mergeUiState(createUiState(), {})
  assert.deepEqual(ui.screenshot, DEFAULT_SCREENSHOT)
  assert.deepEqual(ui.recording, DEFAULT_RECORDING)
})

test("createUiState: returns fresh objects and mutates no constant", () => {
  const a = createUiState()
  const b = createUiState()
  assert.notEqual(a.screenshot, b.screenshot)
  assert.notEqual(a.recording, b.recording)
  a.screenshot.format = "jpeg"
  a.recording.fps = 24
  assert.equal(b.screenshot.format, "png")
  assert.equal(b.recording.fps, 60)
  assert.equal(DEFAULT_SCREENSHOT.format, "png")
  assert.equal(DEFAULT_RECORDING.fps, 60)
})

// ---------------------------------------------------------------------------
// mergeUiState — task 4.5, the loadUiState merge half
// ---------------------------------------------------------------------------

test("mergeUiState: an absent persisted file leaves the base untouched", () => {
  const base = CUSTOM_BASE
  assert.deepEqual(mergeUiState(base, {}), base)
})

test("mergeUiState: last-used values override the base per field", () => {
  const base = CUSTOM_BASE
  const merged = mergeUiState(base, {
    screenshot: { target: "window", delay: 10, format: "png", save: false },
    recording: {
      target: "screen",
      fps: 30,
      format: "gif",
      audio: "microphone",
      quality: "medium",
      duration: 60,
      gifFps: 20,
      size: "50%",
      customDuration: 300,
    },
  })
  assert.deepEqual(merged.screenshot, {
    target: "window",
    delay: 10,
    format: "png",
    save: false,
  })
  assert.deepEqual(merged.recording, {
    target: "screen",
    fps: 30,
    format: "gif",
    audio: "microphone",
    quality: "medium",
    duration: 60,
    gifFps: 20,
    size: "50%",
    customDuration: 300,
  })
  // ...and the base is not mutated: the merge is a pure function of its inputs,
  // so a second call from the same base gives the same answer.
  assert.deepEqual(mergeUiState(base, merged), merged)
  assert.equal(base.screenshot.format, "jpeg")
  assert.equal(base.recording.fps, 24)
})

test("mergeUiState: every accepted enum member round-trips", () => {
  const base = createUiState()
  for (const target of ["region", "screen", "window"] as const) {
    assert.equal(mergeUiState(base, { screenshot: { target } }).screenshot.target, target)
  }
  for (const delay of [0, 3, 5, 10] as const) {
    assert.equal(mergeUiState(base, { screenshot: { delay } }).screenshot.delay, delay)
  }
  for (const size of ["original", "75%", "50%"] as const) {
    assert.equal(mergeUiState(base, { recording: { size } }).recording.size, size)
  }
  for (const fps of [10, 15, 20, 30] as const) {
    assert.equal(mergeUiState(base, { recording: { gifFps: fps } }).recording.gifFps, fps)
  }
  for (const audio of ["none", "system", "microphone"] as const) {
    assert.equal(mergeUiState(base, { recording: { audio } }).recording.audio, audio)
  }
})

test("mergeUiState: an out-of-range enum falls back to the base value", () => {
  const base = CUSTOM_BASE // jpeg/save, 24fps/low/microphone
  // The `as unknown as PersistedUiState` cast is the POINT of this test, not a
  // shortcut: the on-disk `capture-ui.json` is untrusted input, so the values
  // here are ones `PersistedUiState` forbids but a real file can contain (a
  // renamed enum member, a version-skewed field, a hand-edited file). The types
  // stop a caller writing them; nothing stops a JSON file. This is precisely the
  // gap the per-field fallback exists to cover, and a test that could not express
  // it would be testing nothing.
  const persisted = {
    screenshot: { target: "desktop", delay: 7, format: "webp", save: "true" },
    recording: {
      target: "monitor",
      fps: 120,
      format: "avi",
      // `mic` is the CONFIG vocabulary, not the UI one: the persisted UI state
      // is in UI words, so this must fall back rather than be half-understood.
      audio: "mic",
      quality: "perfect",
      gifFps: 25,
      size: "100%",
    },
  } as unknown as PersistedUiState
  const merged = mergeUiState(base, persisted)
  // Every bad value falls back to CUSTOM_BASE, not to the code constants: the
  // base argument is still the per-field authority after REQ-012.
  assert.equal(merged.screenshot.target, "window") // base, not "desktop"
  assert.equal(merged.screenshot.delay, 5) // base, not 7
  assert.equal(merged.screenshot.format, "jpeg") // base, not "webp"
  assert.equal(merged.screenshot.save, true) // base, "true" is not a boolean
  assert.equal(merged.recording.target, "screen") // base, not "monitor"
  assert.equal(merged.recording.fps, 24)
  assert.equal(merged.recording.format, "gif")
  assert.equal(merged.recording.audio, "microphone") // base, "mic" is not a UI word
  assert.equal(merged.recording.quality, "low")
  assert.equal(merged.recording.gifFps, 20)
  assert.equal(merged.recording.size, "50%")
})

test("mergeUiState: null and undefined field values fall back", () => {
  const base = CUSTOM_BASE
  const merged = mergeUiState(base, {
    screenshot: { target: null, delay: undefined, format: null, save: null },
    recording: {
      target: null,
      fps: null,
      format: null,
      audio: null,
      quality: null,
      duration: null,
      gifFps: null,
      size: null,
      customDuration: null,
    },
  } as unknown as PersistedUiState)
  assert.deepEqual(merged, base)
})

test("mergeUiState: a null half is the same as an absent half", () => {
  // The adapter hands over whatever JSON.parse produced. `{"screenshot": null}`
  // must degrade to the base rather than throw on the spread.
  const base = CUSTOM_BASE
  assert.deepEqual(mergeUiState(base, { screenshot: null } as unknown as PersistedUiState), base)
  assert.deepEqual(mergeUiState(base, { recording: null } as unknown as PersistedUiState), base)
  assert.deepEqual(
    mergeUiState(base, { screenshot: null, recording: null } as unknown as PersistedUiState),
    base,
  )
  // NOTE: a null/undefined `persisted` ITSELF is deliberately NOT asserted as
  // safe. `mergeUiState` dereferences `persisted.screenshot` directly, so it
  // throws on null. That is the correct division of labour: the adapter
  // (A5's `glib-ui-state-store`) owns "the file was missing / unparseable" and
  // substitutes `{}` before calling in. Making the merge null-tolerant too
  // would be redundant defensive code, not a fix. See domain/ui-state.ts:122.
  // A non-object half (corrupt JSON that parsed to something odd) is also safe:
  // reading `.screenshot` off a string yields undefined, which spreads to {}.
  assert.deepEqual(mergeUiState(base, "garbage" as unknown as PersistedUiState), base)
  assert.deepEqual(mergeUiState(base, 42 as unknown as PersistedUiState), base)
  assert.deepEqual(mergeUiState(base, [] as unknown as PersistedUiState), base)
})

test("mergeUiState: duration accepts 0 as infinite and rejects negatives", () => {
  const base = CUSTOM_BASE // duration 0
  // 0 is falsy: the classic `|| base` fallback would silently drop the
  // "infinite" selection. It must survive.
  assert.equal(mergeUiState(base, { recording: { duration: 0 } }).recording.duration, 0)
  assert.equal(mergeUiState(base, { recording: { duration: 30 } }).recording.duration, 30)
  assert.equal(mergeUiState(base, { recording: { duration: -1 } }).recording.duration, 0)
  assert.equal(
    mergeUiState(base, { recording: { duration: "60" } } as unknown as PersistedUiState).recording
      .duration,
    0,
  )
  assert.equal(
    mergeUiState(base, { recording: { duration: NaN } }).recording.duration,
    0,
    "NaN fails the >= 0 comparison, so it falls back",
  )
})

test("mergeUiState: save accepts false as a value, not as absence", () => {
  const base = CUSTOM_BASE // save: true
  assert.equal(mergeUiState(base, { screenshot: { save: false } }).screenshot.save, false)
  assert.equal(mergeUiState(base, { screenshot: { save: true } }).screenshot.save, true)
  assert.equal(
    mergeUiState(base, { screenshot: { save: 0 } } as unknown as PersistedUiState).screenshot.save,
    true,
  )
})

test("mergeUiState: customDuration below 5 falls back to the base", () => {
  // The spin editor's range starts at 5s; a persisted 1 or 0 (e.g. a value left
  // over from an older format, or a 0 meaning "not set") must not survive.
  const base = CUSTOM_BASE // customDuration 120
  for (const tooSmall of [4, 1, 0, -1, 4.9]) {
    assert.equal(
      mergeUiState(base, { recording: { customDuration: tooSmall } }).recording.customDuration,
      120,
      `expected fallback for ${tooSmall}`,
    )
  }
})

test("mergeUiState: customDuration above 3600 clamps to 3600", () => {
  const base = CUSTOM_BASE
  // The spec's scenario: 99999 clamps rather than falling back, so the user's
  // "as long as possible" survives instead of resetting to 120.
  assert.equal(
    mergeUiState(base, { recording: { customDuration: 99999 } }).recording.customDuration,
    3600,
  )
  assert.equal(mergeUiState(base, { recording: { customDuration: 3601 } }).recording.customDuration, 3600)
  assert.equal(mergeUiState(base, { recording: { customDuration: 3600 } }).recording.customDuration, 3600)
})

test("mergeUiState: customDuration in range is rounded to whole seconds", () => {
  const base = CUSTOM_BASE
  const merged = (customDuration: number) =>
    mergeUiState(base, { recording: { customDuration } }).recording.customDuration
  assert.equal(merged(5), 5)
  assert.equal(merged(5.4), 5)
  assert.equal(merged(5.5), 6)
  assert.equal(merged(6.49), 6)
  assert.equal(merged(6.5), 7)
  assert.equal(merged(120.4), 120)
  assert.equal(merged(3599.6), 3600)
})

test("mergeUiState: a non-numeric customDuration falls back", () => {
  const base = CUSTOM_BASE
  for (const notANumber of ["300", null, true, {}]) {
    assert.equal(
      mergeUiState(base, { recording: { customDuration: notANumber } } as unknown as PersistedUiState)
        .recording.customDuration,
      120,
    )
  }
})

test("mergeUiState: first run and reload both start from code defaults", () => {
  // REQ-012 precedence: last-used UI state > code constants. Settings are NOT
  // a layer; a legacy config with old defaults cannot seed the lane.
  const chain = (persisted: PersistedUiState): UiState =>
    mergeUiState(createUiState(), persisted)

  // 1. no capture-ui.json -> the code constant
  assert.equal(chain({}).recording.fps, 60)
  assert.equal(chain({}).screenshot.format, "png")
  // 2. a saved lane choice wins
  assert.equal(chain({ recording: { fps: 30 } }).recording.fps, 30)
  assert.equal(chain({ screenshot: { format: "jpeg" } }).screenshot.format, "jpeg")
  // 3. ...but a nonsense saved value falls back to the code constant.
  assert.equal(chain({ recording: { fps: 120 } }).recording.fps, 60)
  assert.equal(
    chain({ screenshot: { format: "webp" } } as unknown as PersistedUiState).screenshot.format,
    "png",
  )
})

// ---------------------------------------------------------------------------
// oneOf — the primitive the merge is built from.
// ---------------------------------------------------------------------------

test("oneOf: membership decides, not coercion", () => {
  assert.equal(oneOf("png", ["png", "jpeg"], "png"), "png")
  assert.equal(oneOf("webp", ["png", "jpeg"], "png"), "png")
  assert.equal(oneOf(30, [24, 30, 60], 60), 30)
  assert.equal(oneOf("30", [24, 30, 60], 60), 60)
  assert.equal(oneOf(null, [24, 30, 60], 60), 60)
  assert.equal(oneOf(undefined, [24, 30, 60], 60), 60)
})

// ---------------------------------------------------------------------------
// The two predicates the recording view asks about (moved with the rest, task
// 3.4). They are pure now, which is why they can be tested at all.
// ---------------------------------------------------------------------------

test("isGif: only the gif format routes through the GIF pipeline", () => {
  assert.equal(isGif({ ...DEFAULT_RECORDING, format: "gif" }), true)
  for (const format of ["mp4", "webm"] as const) {
    assert.equal(isGif({ ...DEFAULT_RECORDING, format }), false)
  }
})

test("durationSelection: a preset duration echoes itself, anything else means custom", () => {
  for (const duration of [0, 10, 30, 60] as const) {
    assert.equal(durationSelection({ ...DEFAULT_RECORDING, duration }), duration)
  }
  // -1 is the sentinel the view uses to show the inline spin editor instead.
  for (const custom of [1, 5, 45, 120, 3600]) {
    assert.equal(durationSelection({ ...DEFAULT_RECORDING, duration: custom }), -1)
  }
})
