"""Commit-path tests for the additive REQ-003 backend flags (design.md §11.3).

The GUI now hands the backend a FINISHED selection:
    --geometry "X,Y WxH"   (region)
    --window 0xADDR        (window reference, resolved here at commit time)
    --monitor NAME         (screen, grim -o / gsr -w / wf-recorder -o)

What must stay true:
  * no flag => the legacy interactive slurp path is byte-identical;
  * any flag => the corresponding slurp call is NEVER made;
  * a vanished window is a typed error, never a silent slurp fallback;
  * screen keeps all-outputs semantics unless --monitor is present.
"""

from __future__ import annotations

import importlib.util
import json
import shlex
from importlib.machinery import SourceFileLoader
from pathlib import Path
from types import SimpleNamespace

import pytest

_BIN = Path(__file__).resolve().parents[2] / "bin" / "capture-tool"


def _load():
    loader = SourceFileLoader("capture_tool_commit", str(_BIN))
    spec = importlib.util.spec_from_loader("capture_tool_commit", loader)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mod = _load()


def _args(**overrides):
    base = {
        "output": None,
        "target": "screen",
        "format": "mp4",
        "fps": 60,
        "quality": "high",
        "audio": "none",
        "duration": 0.0,
        "size": "original",
        "cursor": False,
        "delay": 0,
        "save": False,
        "geometry": None,
        "window": None,
        "monitor": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _no_slurp(monkeypatch):
    def _boom(target):
        raise AssertionError(f"resolve_target({target!r}) must not run on a commit path")

    monkeypatch.setattr(mod, "resolve_target", _boom)


def _screenshot_harness(monkeypatch, tmp_path, *, clients=None):
    calls: list[list[str]] = []

    monkeypatch.setattr(mod, "load_config", lambda: {"screenshot": {"cursor": False}})
    monkeypatch.setattr(mod, "notify_screenshot_saved", lambda *a, **k: None)
    monkeypatch.setattr(mod, "notify_failed", lambda *a, **k: None)
    monkeypatch.setattr(mod.time, "sleep", lambda seconds: calls.append(["sleep", str(seconds)]))

    def _run(command, **kwargs):
        calls.append(list(command))
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(mod.subprocess, "run", _run)
    if clients is not None:
        monkeypatch.setattr(mod, "hyprland_json", lambda command: clients)
    return calls


def _emit_screenshot(args):
    with pytest.raises(SystemExit) as exc:
        mod.screenshot(args)
    assert exc.value.code == 0


# ── parse ──────────────────────────────────────────────────────────────────


def test_parse_defaults_keep_the_new_flags_absent() -> None:
    for command in ("screenshot", "start"):
        parsed = mod.parse_args([command])
        assert parsed.geometry is None
        assert parsed.monitor is None
        assert parsed.window is None


def test_parse_accepts_the_commit_flags_on_both_commands() -> None:
    for command in ("screenshot", "start"):
        parsed = mod.parse_args([
            command,
            "--target", "region",
            "--geometry", "10,20 300x200",
            "--monitor", "DP-1",
            "--window", "0xabc",
        ])
        assert parsed.geometry == "10,20 300x200"
        assert parsed.monitor == "DP-1"
        assert parsed.window == "0xabc"


def test_help_lists_the_commit_flags(capsys) -> None:
    for command in ("screenshot", "start"):
        with pytest.raises(SystemExit) as exc:
            mod.parse_args([command, "--help"])
        assert exc.value.code == 0
        out = capsys.readouterr().out
        assert "--geometry" in out and "--monitor" in out and "--window" in out


# ── geometry spelling ──────────────────────────────────────────────────────


def test_canonical_geometry_accepts_signed_xy_and_rejects_slurp_form() -> None:
    assert mod.canonical_geometry(" 10,20 300x200 ") == "10,20 300x200"
    assert mod.canonical_geometry("-1919,-20 800x600") == "-1919,-20 800x600"
    for bad in ("300x200+10+20", "10,20,300,200", "10 20 300 200", "10,20 0x200"):
        with pytest.raises(ValueError, match="geometry"):
            mod.canonical_geometry(bad)


# ── screenshot ─────────────────────────────────────────────────────────────


def test_geometry_commit_skips_slurp_and_uses_canonical_geometry(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    calls = _screenshot_harness(monkeypatch, tmp_path)
    out = tmp_path / "shot.png"
    _emit_screenshot(
        _args(target="region", geometry="-10,20 300x200", output=str(out))
    )
    grim = next(call for call in calls if call and call[0] == "grim")
    assert grim[grim.index("-g") + 1] == "-10,20 300x200"
    assert str(out) in grim


def test_geometry_commit_sleeps_then_captures_without_selecting(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    calls = _screenshot_harness(monkeypatch, tmp_path)
    _emit_screenshot(
        _args(target="region", geometry="0,0 10x10", delay=3, output=str(tmp_path / "s.png"))
    )
    kinds = [call[0] for call in calls]
    assert kinds.index("sleep") < kinds.index("grim"), "the selection is already final; delay first"
    assert kinds.count("grim") == 1


def test_window_commit_resolves_by_address_and_never_slurps(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    calls = _screenshot_harness(
        monkeypatch,
        tmp_path,
        clients=[
            {"address": "0x55ABC", "at": [40, 50], "size": [800, 600], "title": "firefox"}
        ],
    )
    _emit_screenshot(
        _args(target="window", window="0x55abc", output=str(tmp_path / "w.png"))
    )
    grim = next(call for call in calls if call and call[0] == "grim")
    assert grim[grim.index("-g") + 1] == "40,50 800x600"


def test_vanished_window_is_a_typed_error_never_a_slurp_fallback(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    _screenshot_harness(monkeypatch, tmp_path, clients=[])
    with pytest.raises(mod.WindowNotFoundError, match="0xdead") as exc:
        mod.screenshot(_args(target="window", window="0xdead", output=str(tmp_path / "x.png")))
    assert exc.value.kind == "window_not_found"


def test_screen_monitor_uses_grim_o_and_omits_geometry(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    calls = _screenshot_harness(monkeypatch, tmp_path)
    _emit_screenshot(
        _args(target="screen", monitor="DP-2", output=str(tmp_path / "screen.png"))
    )
    grim = next(call for call in calls if call and call[0] == "grim")
    assert grim[grim.index("-o") + 1] == "DP-2"
    assert "-g" not in grim


def test_legacy_screen_without_monitor_stays_all_outputs(monkeypatch, tmp_path: Path) -> None:
    selected: list[str] = []
    monkeypatch.setattr(mod, "resolve_target", lambda target: selected.append(target) or "eDP-1")
    calls = _screenshot_harness(monkeypatch, tmp_path)
    _emit_screenshot(_args(target="screen", output=str(tmp_path / "legacy.png")))
    grim = next(call for call in calls if call and call[0] == "grim")
    # Legacy screen never needed resolve_target: grim's all-outputs mode is
    # the absence of both -o and -g.
    assert selected == []
    assert "-o" not in grim and "-g" not in grim


def test_legacy_region_without_geometry_still_slurps_and_normalises(
    monkeypatch, tmp_path: Path
) -> None:
    selected: list[str] = []
    monkeypatch.setattr(
        mod, "resolve_target", lambda target: selected.append(target) or "300x200+10+20"
    )
    calls = _screenshot_harness(monkeypatch, tmp_path)
    _emit_screenshot(_args(target="region", output=str(tmp_path / "legacy.png")))
    grim = next(call for call in calls if call and call[0] == "grim")
    assert selected == ["region"]
    assert grim[grim.index("-g") + 1] == "10,20 300x200"


# ── recording ──────────────────────────────────────────────────────────────


def _recording_harness(monkeypatch, tmp_path, backend="gpu-screen-recorder"):
    spawned: list[list[str]] = []
    monkeypatch.setattr(mod, "choose_backend", lambda: backend)
    monkeypatch.setattr(
        mod.shutil,
        "which",
        lambda name: {
            "dotfiles-runtime": "/usr/bin/dotfiles-runtime",
            "ffmpeg": "ffmpeg",
        }.get(name),
    )
    monkeypatch.setattr(mod, "_spawn_capture_host", lambda argv: spawned.append(list(argv)))
    monkeypatch.setattr(mod, "_ensure_parent_dir", lambda path: None)
    monkeypatch.setattr(mod, "resolve_audio_device", lambda audio, run=None: None)
    return spawned


def _emit_recording(args):
    with pytest.raises(SystemExit) as exc:
        mod.start_recording(args)
    assert exc.value.code == 0


def test_recording_region_geometry_skips_slurp_and_uses_recorder_form(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    spawned = _recording_harness(monkeypatch, tmp_path)
    _emit_recording(
        _args(target="region", geometry="10,20 300x200", output=str(tmp_path / "r.mp4"))
    )
    command = shlex.split(spawned[0][spawned[0].index("--command") + 1])
    assert command[command.index("-region") + 1] == "300x200+10+20"


def test_recording_window_commit_resolves_at_commit_and_skips_slurp(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    spawned = _recording_harness(monkeypatch, tmp_path)
    monkeypatch.setattr(
        mod,
        "hyprland_json",
        lambda command: [
            {"address": "0xabc", "at": [5, 6], "size": [1280, 800], "title": "x"}
        ],
    )
    _emit_recording(
        _args(target="window", window="0xabc", output=str(tmp_path / "r.mp4"))
    )
    command = shlex.split(spawned[0][spawned[0].index("--command") + 1])
    assert command[command.index("-region") + 1] == "1280x800+5+6"


def test_recording_screen_monitor_uses_the_output_name(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    spawned = _recording_harness(monkeypatch, tmp_path)
    _emit_recording(
        _args(target="screen", monitor="DP-2", output=str(tmp_path / "r.mp4"))
    )
    command = shlex.split(spawned[0][spawned[0].index("--command") + 1])
    assert command[command.index("-w") + 1] == "DP-2"
    assert "-region" not in command


def test_recording_screen_monitor_on_wf_recorder_uses_output_flag(
    monkeypatch, tmp_path: Path
) -> None:
    _no_slurp(monkeypatch)
    spawned = _recording_harness(monkeypatch, tmp_path, backend="wf-recorder")
    _emit_recording(
        _args(target="screen", monitor="HDMI-1", output=str(tmp_path / "r.mp4"))
    )
    command = shlex.split(spawned[0][spawned[0].index("--command") + 1])
    assert command[command.index("-o") + 1] == "HDMI-1"
    assert "-g" not in command


def test_recording_legacy_screen_still_resolves_the_focused_monitor(
    monkeypatch, tmp_path: Path
) -> None:
    selected: list[str] = []
    monkeypatch.setattr(mod, "resolve_target", lambda target: selected.append(target) or "eDP-1")
    spawned = _recording_harness(monkeypatch, tmp_path)
    _emit_recording(_args(target="screen", output=str(tmp_path / "r.mp4")))
    command = shlex.split(spawned[0][spawned[0].index("--command") + 1])
    assert selected == ["screen"]
    assert command[command.index("-w") + 1] == "eDP-1"


def test_recording_vanished_window_is_typed(monkeypatch, tmp_path: Path) -> None:
    _no_slurp(monkeypatch)
    _recording_harness(monkeypatch, tmp_path)
    monkeypatch.setattr(mod, "hyprland_json", lambda command: [])
    with pytest.raises(mod.WindowNotFoundError):
        mod.start_recording(_args(target="window", window="0xdead", output=str(tmp_path / "r.mp4")))
