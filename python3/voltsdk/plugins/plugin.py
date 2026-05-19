"""Generic plugin class executed via local subprocess."""

from __future__ import annotations

import os
import shlex
import subprocess
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
        return self.artifacts.get(name)


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
        config = {**self.options, **options}
        binary = self._resolve_binary()
        input_path = Path(input_file).expanduser().resolve()
        output = Path(output_base).expanduser() if output_base else input_path.with_suffix("")
        output.parent.mkdir(parents=True, exist_ok=True)

        command = [str(binary), str(input_path), str(output), *_argv(config)]
        completed = subprocess.run(
            command,
            cwd=self.root,
            env=_env(self.root),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=None if timeout is None or timeout < 0 else timeout,
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

    def _resolve_binary(self) -> Path:
        if not self.manifest.binary:
            raise PluginError(f"Plugin {self.manifest.key!r} has no entrypoint binary.")
        candidate = self.root / "bin" / self.manifest.binary
        if not candidate.exists() and os.name == "nt":
            candidate = candidate.with_suffix(".exe")
        if not candidate.exists():
            raise PluginError(f"Missing binary at {candidate}.")
        return candidate.resolve()

    def _collect_artifacts(self, output: Path) -> dict[str, Path]:
        result: dict[str, Path] = {}
        for output_spec in self.manifest.outputs:
            if not output_spec.suffix:
                continue
            path = Path(f"{output}{output_spec.suffix}")
            if path.exists():
                result[output_spec.name] = path
        for exposure in self.manifest.exposures:
            path = Path(f"{output}_{exposure}")
            if path.exists():
                result.setdefault(exposure, path)
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
        args.extend([flag, str(value)])
    return args


def _env(root: Path) -> dict[str, str]:
    env = os.environ.copy()
    bin_dir = root / "bin"
    lib_dir = root / "lib"
    paths = [str(directory) for directory in (bin_dir, lib_dir) if directory.exists()]
    if paths:
        env["PATH"] = os.pathsep.join([*paths, env.get("PATH", "")]).rstrip(os.pathsep)
    if lib_dir.exists():
        for key in ("LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"):
            current = env.get(key, "")
            env[key] = os.pathsep.join([str(lib_dir), current]).rstrip(os.pathsep)
    return env
