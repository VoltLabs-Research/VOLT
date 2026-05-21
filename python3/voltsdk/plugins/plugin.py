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


@dataclass
class PluginRun:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    output_base: Path
    artifacts: dict[str, Path] = field(default_factory=dict)

    def artifact(self, name: str) -> Path | None:
        for candidate in _artifact_lookup_candidates(name):
            artifact = self.artifacts.get(candidate)
            if artifact is not None:
                return artifact
        stem = Path(name).stem
        for key, artifact in self.artifacts.items():
            if Path(key).stem == stem:
                return artifact
        return None

    def path(self, name: str) -> Path:
        artifact = self.artifact(name)
        if artifact is not None:
            return artifact
        available = ', '.join(sorted(self.artifacts)) or '<none>'
        raise PluginError(f'Artifact {name!r} not found. Available artifacts: {available}.')

    def df(self, name: str, key: str | None = None):
        path = self.path(name)
        suffix = path.suffix.lower()
        if suffix == '.msgpack':
            from ..io.msgpack import msgpack_as_df

            return msgpack_as_df(str(path), key)
        if suffix == '.json':
            return _json_df(path, key)
        raise PluginError(f'Artifact {path.name!r} is not a supported dataframe source.')


class Plugin:
    """A single plugin instance backed by a downloaded bundle.

    Plugins are obtained from :class:`voltsdk.plugins.PluginHub`; the user does
    not instantiate this class directly.
    """

    def __init__(self, key: str, version: str, root: Path) -> None:
        self._key = key
        self._version = version
        self.root = Path(root)
        self.options: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def configure(self, **options: Any) -> "Plugin":
        self.options.update(options)
        return self

    def __call__(self, **options: Any) -> "Plugin":
        clone = Plugin(self._key, self._version, self.root)
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
        config = _prepare_config({**self.options, **options})
        input_path = Path(input_file).expanduser().resolve()
        output = Path(output_base).expanduser().resolve() if output_base else input_path.with_suffix("")
        output.parent.mkdir(parents=True, exist_ok=True)

        command, completed = self._run_subprocess(
            input_path,
            output,
            config,
            timeout=timeout,
        )
        result = PluginRun(
            command=command,
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
            output_base=output.resolve(),
            artifacts=self._collect_artifacts(output),
        )
        if completed.returncode != 0:
            raise PluginError(
                f"{self._key} failed (exit {completed.returncode}).\n"
                f"$ {shlex.join(command)}\n{completed.stderr.strip()}"
            )
        return result

    # ------------------------------------------------------------------
    # Inspection helpers
    # ------------------------------------------------------------------

    @property
    def key(self) -> str:
        return self._key

    @property
    def version(self) -> str:
        return self._version

    @property
    def arguments(self) -> tuple:
        return ()

    def __repr__(self) -> str:
        return f"<Plugin key={self._key!r} version={self._version!r}>"

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _resolve_entrypoint(self) -> list[str]:
        binary = self._resolve_binary()
        if binary is not None:
            return [str(binary)]

        script = self._resolve_script()
        if script is not None:
            if script.suffix.lower() == ".py":
                return [sys.executable, str(script)]
            return [str(script)]

        raise PluginError(f"Could not resolve an entrypoint inside {self.root}.")

    def _resolve_binary(self) -> Path | None:
        bin_dir = self.root / "bin"
        if not bin_dir.is_dir():
            return None

        preferred = [bin_dir / self._key]
        if os.name == "nt":
            preferred.insert(0, bin_dir / f"{self._key}.exe")
        for candidate in preferred:
            if candidate.is_file():
                return candidate.resolve()

        candidates = sorted(path for path in bin_dir.iterdir() if path.is_file())
        if len(candidates) == 1:
            return candidates[0].resolve()
        if candidates:
            executables = [path for path in candidates if os.access(path, os.X_OK) or path.suffix.lower() == ".exe"]
            if len(executables) == 1:
                return executables[0].resolve()
            raise PluginError(
                f"Multiple binaries found for plugin {self._key!r}: "
                + ", ".join(path.name for path in executables or candidates)
            )
        return None

    def _resolve_script(self) -> Path | None:
        scripts_dir = self.root / "scripts"
        if not scripts_dir.is_dir():
            return None

        wrappers = sorted(
            path
            for path in scripts_dir.iterdir()
            if path.is_file() and path.suffix.lower() == ".py" and path.name.endswith("_wrapper.py")
        )
        if len(wrappers) == 1:
            return wrappers[0].resolve()

        candidates = sorted(path for path in scripts_dir.iterdir() if path.is_file())
        if len(candidates) == 1:
            return candidates[0].resolve()
        if candidates:
            raise PluginError(
                f"Multiple scripts found for plugin {self._key!r}: "
                + ", ".join(path.name for path in candidates)
            )
        return None

    def _run_subprocess(
        self,
        input_path: Path,
        output: Path,
        config: dict[str, Any],
        *,
        timeout: int | float | None,
    ) -> tuple[list[str], subprocess.CompletedProcess[str]]:
        command = [*self._resolve_entrypoint(), str(input_path), str(output), *_argv(config)]
        completed = _subprocess_run(command, self.root, timeout)
        return command, completed

    def _collect_artifacts(self, output: Path) -> dict[str, Path]:
        result: dict[str, Path] = {}
        directory = output.parent
        prefix = output.name
        exact = output if output.is_file() else None
        if exact is not None:
            result[exact.name] = exact

        for path in sorted(directory.glob(f"{prefix}*")):
            if not path.is_file() or path == exact:
                continue
            key = _canonical_artifact_name(prefix, path.name)
            result[key] = path
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
    return config


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


def _artifact_lookup_candidates(name: str) -> tuple[str, ...]:
    candidates: list[str] = [name]
    if name.endswith(".msgpack"):
        candidates.append(f"{name[:-8]}.json")
    elif name.endswith(".json"):
        candidates.append(f"{name[:-5]}.msgpack")
    else:
        candidates.extend([f"{name}.msgpack", f"{name}.json"])
    return tuple(dict.fromkeys(candidates))


def _canonical_artifact_name(prefix: str, filename: str) -> str:
    if filename == prefix:
        return filename
    if filename.startswith(f"{prefix}_"):
        return filename[len(prefix) + 1 :]
    return filename


def _json_df(path: Path, key: str | None):
    import pandas as pd

    from ..io.msgpack import get_nested_value

    with path.open('r', encoding='utf-8') as fh:
        data = get_nested_value(json.load(fh), key)
    return _data_as_df(data, pd)


def _data_as_df(data: Any, pd):
    if data is None:
        return pd.DataFrame()
    if isinstance(data, list):
        return pd.DataFrame(data)
    if _is_columnar_dict(data):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        return pd.DataFrame([data])
    return pd.DataFrame([{'value': data}])


def _is_columnar_dict(value: Any) -> bool:
    if not isinstance(value, dict) or not value:
        return False
    lengths: list[int] = []
    for item in value.values():
        if not isinstance(item, list):
            return False
        lengths.append(len(item))
    return len(set(lengths)) == 1


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
