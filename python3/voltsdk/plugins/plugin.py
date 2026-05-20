"""Generic plugin class executed via local subprocess."""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .errors import PluginError
from .manifest import Manifest


@dataclass
class PluginRun:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    output_base: Path
    artifacts: dict[str, Path] = field(default_factory=dict)

    def artifact(self, name: str) -> Path | None:
        artifact = self.artifacts.get(name)
        if artifact is not None:
            return artifact
        if name.endswith(".msgpack"):
            return self.artifacts.get(f"{name[:-8]}.json")
        if name.endswith(".json"):
            return self.artifacts.get(f"{name[:-5]}.msgpack")
        return None


class Plugin:
    """A single plugin instance backed by a downloaded bundle.

    Plugins are obtained from :class:`voltsdk.plugins.PluginHub`; the user does
    not instantiate this class directly. The same class powers every plugin —
    behaviour comes from ``plugin.json``.
    """

    def __init__(self, manifest: Manifest, root: Path) -> None:
        self.manifest = manifest
        self.root = Path(root)
        self.options: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def configure(self, **options: Any) -> "Plugin":
        self.options.update(options)
        return self

    def __call__(self, **options: Any) -> "Plugin":
        clone = Plugin(self.manifest, self.root)
        clone.options = {**self.options, **options}
        return clone

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    def run(
        self,
        input_file: str | os.PathLike[str],
        *,
        output_base: str | os.PathLike[str] | None = None,
        timeout: int | float | None = None,
        **options: Any,
    ) -> PluginRun:
        raw_options = {**self.options, **options}
        explicit_export_format = _has_explicit_export_format(raw_options)
        config = _prepare_config(raw_options)
        input_path = Path(input_file).expanduser().resolve()
        output = Path(output_base).expanduser() if output_base else input_path.with_suffix("")
        output.parent.mkdir(parents=True, exist_ok=True)

        command, completed, effective_config = self._run_subprocess(
            input_path,
            output,
            config,
            timeout=timeout,
            explicit_export_format=explicit_export_format,
        )
        result = PluginRun(
            command=command,
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
            output_base=output.resolve(),
            artifacts=self._collect_artifacts(output, effective_config),
        )
        if completed.returncode != 0:
            raise PluginError(
                f"{self.manifest.key} failed (exit {completed.returncode}).\n"
                f"$ {shlex.join(command)}\n{completed.stderr.strip()}"
            )
        return result

    # ------------------------------------------------------------------
    # Inspection helpers
    # ------------------------------------------------------------------

    @property
    def key(self) -> str:
        return self.manifest.key

    @property
    def version(self) -> str:
        return self.manifest.version

    @property
    def arguments(self) -> tuple:
        return self.manifest.arguments

    def __repr__(self) -> str:
        return f"<Plugin key={self.manifest.key!r} version={self.manifest.version!r}>"

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _resolve_entrypoint(self) -> list[str]:
        if self.manifest.entrypoint_script:
            script_path = (self.root / self.manifest.entrypoint_script).resolve()
            if script_path.exists():
                if script_path.suffix.lower() == ".py":
                    return [sys.executable, str(script_path)]
                return [str(script_path)]

        return [str(self._resolve_binary())]

    def _resolve_binary(self) -> Path:
        if not self.manifest.binary:
            raise PluginError(f"Plugin {self.manifest.key!r} has no entrypoint binary.")
        candidate = self.root / "bin" / self.manifest.binary
        if not candidate.exists() and os.name == "nt":
            candidate = candidate.with_suffix(".exe")
        if not candidate.exists():
            raise PluginError(f"Missing binary at {candidate}.")
        return candidate.resolve()

    def _run_subprocess(
        self,
        input_path: Path,
        output: Path,
        config: dict[str, Any],
        *,
        timeout: int | float | None,
        explicit_export_format: bool,
    ) -> tuple[list[str], subprocess.CompletedProcess[str], dict[str, Any]]:
        command = [*self._resolve_entrypoint(), str(input_path), str(output), *_argv(config)]
        completed = _subprocess_run(command, self.root, timeout)
        if (
            completed.returncode != 0
            and not explicit_export_format
            and _should_retry_without_export_flag(config, completed.stderr)
        ):
            fallback_config = dict(config)
            fallback_config.pop("export-as", None)
            fallback_command = [*self._resolve_entrypoint(), str(input_path), str(output), *_argv(fallback_config)]
            fallback_completed = _subprocess_run(fallback_command, self.root, timeout)
            return fallback_command, fallback_completed, fallback_config
        return command, completed, config

    def _collect_artifacts(self, output: Path, config: dict[str, Any]) -> dict[str, Path]:
        result: dict[str, Path] = {}
        export_format = _resolve_export_format(config)
        for output_spec in self.manifest.outputs:
            if not output_spec.suffix:
                continue
            for suffix in _artifact_suffix_candidates(output_spec.suffix, export_format):
                path = Path(f"{output}{suffix}")
                if path.exists():
                    result[output_spec.name] = path
                    break
        for exposure in self.manifest.exposures:
            for exposure_name in _artifact_name_candidates(exposure, export_format):
                path = Path(f"{output}_{exposure_name}")
                if path.exists():
                    result.setdefault(exposure, path)
                    if exposure_name != exposure:
                        result.setdefault(exposure_name, path)
                    break
        return result


def _argv(options: dict[str, Any]) -> list[str]:
    args: list[str] = []
    for key, value in options.items():
        if value is None:
            continue
        flag = f"--{key}"
        if isinstance(value, bool):
            args.extend([flag, "true" if value else "false"])
            continue
        if isinstance(value, (dict, list, tuple)):
            args.extend([flag, json.dumps(value, separators=(",", ":"), ensure_ascii=True)])
            continue
        args.extend([flag, str(value)])
    return args


def _prepare_config(options: dict[str, Any]) -> dict[str, Any]:
    config = dict(options)
    for alias in ("export_as", "exportAs"):
        value = config.pop(alias, None)
        if value is not None and config.get("export-as") is None:
            config["export-as"] = value
    if config.get("export-as") is None:
        config["export-as"] = "json"
    return config


def _has_explicit_export_format(options: dict[str, Any]) -> bool:
    return any(alias in options for alias in ("export-as", "export_as", "exportAs"))


def _subprocess_run(
    command: list[str],
    root: Path,
    timeout: int | float | None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=root,
        env=_env(root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=None if timeout is None or timeout < 0 else timeout,
    )


def _should_retry_without_export_flag(config: dict[str, Any], stderr: str) -> bool:
    if config.get("export-as") is None:
        return False
    return "--export-as" in stderr and (
        "Argumentos no soportados" in stderr
        or "unsupported" in stderr.lower()
    )


def _resolve_export_format(config: dict[str, Any]) -> str:
    export_format = str(config.get("export-as", "json")).strip().lower()
    return export_format if export_format in {"json", "msgpack"} else "json"


def _artifact_suffix_candidates(suffix: str, export_format: str) -> tuple[str, ...]:
    if not suffix.endswith(".msgpack"):
        return (suffix,)
    json_suffix = f"{suffix[:-8]}.json"
    if export_format == "json":
        return (json_suffix, suffix)
    return (suffix, json_suffix)


def _artifact_name_candidates(name: str, export_format: str) -> tuple[str, ...]:
    if not name.endswith(".msgpack"):
        return (name,)
    json_name = f"{name[:-8]}.json"
    if export_format == "json":
        return (json_name, name)
    return (name, json_name)


def _env(root: Path) -> dict[str, str]:
    env = os.environ.copy()
    plugin_bin_dir = root / "bin"
    plugin_lib_dir = root / "lib"
    runtime_bin_dir, runtime_lib_dir = _bundled_runtime_dirs()
    _prepend_env_paths(env, "PATH", plugin_bin_dir, plugin_lib_dir, runtime_bin_dir, runtime_lib_dir)
    _prepend_env_paths(env, "LD_LIBRARY_PATH", plugin_lib_dir, runtime_lib_dir)
    _prepend_env_paths(env, "DYLD_LIBRARY_PATH", plugin_lib_dir, runtime_lib_dir)
    return env


def _bundled_runtime_dirs() -> tuple[Path | None, Path | None]:
    try:
        from ..native import bin_dir, lib_dir
    except Exception:
        return None, None
    return bin_dir(), lib_dir()


def _prepend_env_paths(env: dict[str, str], key: str, *candidates: Path | None) -> None:
    entries = [str(candidate) for candidate in candidates if candidate is not None and candidate.exists()]
    if not entries:
        return
    current_entries = [entry for entry in env.get(key, "").split(os.pathsep) if entry]
    merged: list[str] = []
    seen: set[str] = set()
    for entry in [*entries, *current_entries]:
        if entry in seen:
            continue
        merged.append(entry)
        seen.add(entry)
    env[key] = os.pathsep.join(merged)
