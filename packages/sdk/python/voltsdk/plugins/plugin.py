from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from .errors import PluginError
from .interface import (
    Param,
    PluginInterface,
    Requirement,
    build_signature,
    coerce_param,
    describe_interface,
    load_interface,
)

@dataclass(frozen=True)
class PluginArtifact(os.PathLike[str]):
    run: "PluginRun"
    name: str
    path: Path

    def __fspath__(self) -> str:
        return str(self.path)

    def __str__(self) -> str:
        return str(self.path)

    def json(self, key: str | None = None) -> Any:
        if self.path.suffix.lower() != '.json':
            raise PluginError(f'Artifact {self.path.name!r} is not a JSON artifact.')

        from ..io.msgpack import get_nested_value

        with self.path.open('r', encoding='utf-8') as fh:
            return get_nested_value(json.load(fh), key)

    def df(self, key: str | None = None):
        return _artifact_df(self.path, key)

    def glb(
        self,
        *,
        output_path: str | os.PathLike[str] | None = None,
        exporter: str | None = None,
        **options: Any,
    ) -> Path:
        from ..spatial import SpatialAssembler

        if _is_glb_artifact(self.path):
            return self.path

        target = Path(output_path).expanduser().resolve() if output_path else _default_glb_output_path(self.path)
        result = SpatialAssembler().glb(self.path, output_path=target, exporter=exporter, **options)
        if not isinstance(result, Path):
            raise PluginError('SpatialAssembler did not return a file path.')
        return result

    def open_in_volt(
        self,
        *,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from ..viewer import open_in_volt

        source = self.path if _is_glb_artifact(self.path) else self.glb()
        return open_in_volt(source, volt_url=volt_url, open_browser=open_browser)

    def __repr__(self) -> str:
        return f"<PluginArtifact name={self.name!r} path={str(self.path)!r}>"

@dataclass
class PluginRun:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    output_prefix: Path
    output_dir: Path
    artifacts: dict[str, Path] = field(default_factory=dict)
    provides: dict[str, dict[str, Path]] = field(default_factory=dict)
    unmet: dict[str, tuple[str, ...]] = field(default_factory=dict)

    def __getitem__(self, name: str) -> PluginArtifact:
        path = self._resolve_artifact_path(name)
        return PluginArtifact(run=self, name=name, path=path)

    def __iter__(self):
        return iter(self.artifacts)

    def __contains__(self, name: str) -> bool:
        return self._find_artifact_path(name) is not None

    def _resolve_artifact_path(self, name: str) -> Path:
        artifact = self._find_artifact_path(name)
        if artifact is not None:
            return artifact
        available = ', '.join(sorted(self.artifacts)) or '<none>'
        raise PluginError(f'Artifact {name!r} not found. Available artifacts: {available}.')

    def _find_artifact_path(self, name: str) -> Path | None:
        artifact = self.artifacts.get(name)
        if artifact is not None:
            return artifact
        stem = Path(name).stem
        if stem == name:
            for key, artifact in self.artifacts.items():
                if Path(key).stem == stem:
                    return artifact
        return None

class Plugin:

    def __init__(self, key: str, version: str, root: Path) -> None:
        self._key = key
        self._version = version
        self.root = Path(root)
        self._interface = load_interface(self.root, plugin_key=key)
        self.__signature__ = build_signature(self._interface)
        self.__doc__ = describe_interface(self._interface, key, version)

    def __call__(
        self,
        source: Any,
        *,
        output_dir: str | os.PathLike[str] | None = None,
        output_name: str | None = None,
        timeout: int | float | None = None,
        **kwargs: Any,
    ) -> PluginRun:
        bindings, options = self._split_kwargs(kwargs)
        input_path, wired = self._resolve_wiring(source, bindings)

        output_prefix = _resolve_output_prefix(
            input_path,
            plugin_key=self._key,
            output_dir=output_dir,
            output_name=output_name,
        )
        output_prefix.parent.mkdir(parents=True, exist_ok=True)

        command = [
            *self._resolve_entrypoint(),
            str(input_path),
            str(output_prefix),
            *wired,
            *self._option_argv(options),
        ]
        completed = _subprocess_run(command, self.root, timeout)

        artifacts = self._collect_artifacts(output_prefix)
        provides, unmet = self._resolve_provides(artifacts)
        result = PluginRun(
            command=command,
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
            output_prefix=output_prefix.resolve(),
            output_dir=output_prefix.parent.resolve(),
            artifacts=artifacts,
            provides=provides,
            unmet=unmet,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or '').strip() or (completed.stdout or '').strip()
            error = PluginError(
                f"{self._key} failed (exit {completed.returncode}).\n"
                f"$ {shlex.join(command)}\n{detail}".rstrip()
            )
            error.run = result
            raise error
        return result

    @property
    def key(self) -> str:
        return self._key

    @property
    def version(self) -> str:
        return self._version

    @property
    def interface(self) -> PluginInterface:
        return self._interface

    @property
    def params(self) -> Mapping[str, Param]:
        return self._interface.params

    def __repr__(self) -> str:
        return f"<Plugin key={self._key!r} version={self._version!r}>"

    def _split_kwargs(self, kwargs: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        requirement_ids = {requirement.id for requirement in self._interface.requires}
        bindings: dict[str, Any] = {}
        options: dict[str, Any] = {}
        unknown: list[str] = []
        for name, value in kwargs.items():
            if name in requirement_ids:
                bindings[name] = value
            elif name in self._interface.params:
                options[name] = value
            else:
                unknown.append(name)
        if unknown:
            raise PluginError(
                f'{self._key} got unexpected argument(s): {", ".join(sorted(unknown))}.\n'
                f'{self._accepted_summary()}'
            )
        return bindings, options

    def _accepted_summary(self) -> str:
        lines = []
        if self._interface.requires:
            lines.append('Accepted inputs: ' + ', '.join(
                f'{requirement.id} ({requirement.capability})'
                for requirement in self._interface.requires
            ))
        lines.append('Accepted parameters: ' + (', '.join(self._interface.param_names) or '<none>'))
        return '\n'.join(lines)

    def _resolve_wiring(self, source: Any, bindings: Mapping[str, Any]) -> tuple[Path, list[str]]:
        interface = self._interface
        input_spec = interface.input

        if input_spec.requirement is not None and input_spec.requirement not in bindings:
            bindings = {**bindings, input_spec.requirement: source}

        resolved: dict[str, list[Mapping[str, Path]]] = {}
        for requirement in interface.requires:
            value = bindings.get(requirement.id)
            if value is None:
                if requirement.required:
                    raise PluginError(self._unbound_message(requirement))
                continue
            sources = list(value) if requirement.multiple and isinstance(value, (list, tuple)) else [value]
            resolved[requirement.id] = [
                self._capability_ports(requirement, item) for item in sources
            ]

        if input_spec.requirement is None:
            if isinstance(source, PluginRun):
                raise PluginError(
                    f'{self._key} takes a trajectory file as its input, not a plugin run. '
                    f'Pass a path, or one of the run\'s artifacts.'
                )
            input_path = Path(os.fspath(source)).expanduser().resolve()
        else:
            ports = resolved[input_spec.requirement][0]
            port = input_spec.port or ''
            if port not in ports:
                raise PluginError(
                    f'{self._key} reads its input from {input_spec.requirement}.{port}, '
                    f'which the upstream run does not provide '
                    f'(has: {", ".join(sorted(ports)) or "<none>"}).'
                )
            input_path = Path(ports[port]).resolve()

        return input_path, self._wired_argv(resolved)

    def _wired_argv(self, resolved: Mapping[str, list[Mapping[str, Path]]]) -> list[str]:
        argv: list[str] = []
        for requirement in self._interface.requires:
            sources = resolved.get(requirement.id)
            if not sources:
                continue
            for port, flag in requirement.bind.items():
                paths: list[str] = []
                for ports in sources:
                    if port not in ports:
                        raise PluginError(
                            f'{self._key} needs {requirement.id}.{port} for {flag}, but the '
                            f'upstream run provides only: {", ".join(sorted(ports)) or "<none>"}.'
                        )
                    paths.append(str(ports[port]))
                argv.extend([flag, ','.join(paths)])
        return argv

    def _capability_ports(self, requirement: Requirement, value: Any) -> Mapping[str, Path]:
        if not isinstance(value, PluginRun):
            kind = 'a path' if isinstance(value, (str, os.PathLike)) else type(value).__name__
            raise PluginError(
                f'{self._key} needs {requirement.id} to provide {requirement.capability}, '
                f'but got {kind}. Pass the upstream plugin run itself, so the SDK can wire '
                f'every port the capability carries.'
            )
        ports = value.provides.get(requirement.capability)
        if ports is not None:
            return ports

        missing = value.unmet.get(requirement.capability)
        if missing:
            raise PluginError(
                f'{self._key} needs {requirement.capability} from {requirement.id}, but the '
                f'upstream run did not produce: {", ".join(missing)}.'
            )
        available = ', '.join(sorted(value.provides)) or '<none>'
        raise PluginError(
            f'{self._key} needs {requirement.capability} from {requirement.id}, which the '
            f'upstream run does not provide. It provides: {available}.'
        )

    def _unbound_message(self, requirement: Requirement) -> str:
        return (
            f'{self._key} requires {requirement.capability} and nothing supplied it. '
            f'Pass the upstream run as the positional argument, or as {requirement.id}=<run>.'
        )

    def _option_argv(self, options: Mapping[str, Any]) -> list[str]:
        argv: list[str] = []
        for name, value in options.items():
            if value is None:
                continue
            param = self._interface.params[name]
            argv.extend([param.flag, coerce_param(param, value)])
        for param in self._interface.params.values():
            if param.bundle_default is None or param.name in options:
                continue
            path = self.root / param.bundle_default
            if not path.exists():
                raise PluginError(
                    f'{self._key} declares {param.flag} defaults to {param.bundle_default} '
                    f'inside the bundle, but {path} is missing from the installed plugin.'
                )
            argv.extend([param.flag, str(path)])
        return argv

    def _resolve_entrypoint(self) -> list[str]:
        binary = self._pick_file(self.root / "bin", prefer_named=True)
        if binary is not None:
            return [str(binary)]

        script = self._pick_file(self.root / "scripts", prefer_named=False)
        if script is not None:
            if script.suffix.lower() == ".py":
                return [sys.executable, str(script)]
            return [str(script)]

        raise PluginError(f"Could not resolve an entrypoint inside {self.root}.")

    def _pick_file(self, directory: Path, *, prefer_named: bool) -> Path | None:
        if not directory.is_dir():
            return None
        files = sorted(path for path in directory.iterdir() if path.is_file())
        if not files:
            return None
        if len(files) == 1:
            return files[0].resolve()
        if prefer_named:
            short = self._key.rsplit('/', 1)[-1]
            by_name = {path.name: path for path in files}
            for name in (short, f'{short}.exe'):
                if name in by_name:
                    return by_name[name].resolve()
        raise PluginError(
            f"Ambiguous plugin entrypoint in {directory}: " + ", ".join(p.name for p in files)
        )

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

    def _resolve_provides(
        self, artifacts: Mapping[str, Path]
    ) -> tuple[dict[str, dict[str, Path]], dict[str, tuple[str, ...]]]:
        provides: dict[str, dict[str, Path]] = {}
        unmet: dict[str, tuple[str, ...]] = {}
        for capability, ports in self._interface.provides.items():
            resolved: dict[str, Path] = {}
            missing: list[str] = []
            for port, artifact_name in ports.items():
                path = artifacts.get(artifact_name)
                if path is None:
                    missing.append(f'{port} ({artifact_name})')
                else:
                    resolved[port] = path
            if missing:
                unmet[capability] = tuple(missing)
            else:
                provides[capability] = resolved
        return provides, unmet

def _resolve_output_prefix(
    input_path: Path,
    *,
    plugin_key: str,
    output_dir: str | os.PathLike[str] | None,
    output_name: str | None,
) -> Path:
    if output_name is not None and output_name.strip() == '':
        raise PluginError('output_name cannot be empty.')

    if output_dir is None:
        return input_path.with_suffix('').resolve()

    name = output_name or _plugin_output_name(plugin_key)
    return (Path(output_dir).expanduser() / name).resolve()

def _plugin_output_name(plugin_key: str) -> str:
    name = plugin_key.rsplit('/', 1)[-1]
    normalized = re.sub(r'[^A-Za-z0-9_.-]+', '-', name).strip('-._')
    return normalized or 'plugin'

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

def _canonical_artifact_name(prefix: str, filename: str) -> str:
    if filename == prefix:
        return filename
    if filename.startswith(f"{prefix}_"):
        return filename[len(prefix) + 1 :]
    return filename

def _is_glb_artifact(path: Path) -> bool:
    suffix = path.suffix.lower()
    return suffix in {'.glb', '.gltf'} or path.name.lower().endswith('.glb.zst')

def _default_glb_output_path(path: Path) -> Path:
    suffix = path.suffix.lower()
    if suffix:
        return path.with_suffix('.glb')
    return path.with_name(f'{path.name}.glb')

def _artifact_df(path: Path, key: str | None):
    suffix = path.suffix.lower()
    if suffix == '.parquet':
        return _parquet_df(path, key)
    if suffix == '.msgpack':
        from ..io.msgpack import msgpack_as_df

        return msgpack_as_df(str(path), key)
    if suffix == '.json':
        return _json_df(path, key)
    raise PluginError(f'Artifact {path.name!r} is not a supported dataframe source.')

def _parquet_df(path: Path, key: str | None):
    import pandas as pd

    from ..io.msgpack import frame_from_data, get_nested_value

    frame = pd.read_parquet(path)

    if list(frame.columns) == ['payload'] and len(frame) == 1:
        data = json.loads(frame['payload'].iloc[0])
        return frame_from_data(get_nested_value(data, key))

    if key is None:
        return frame
    if key not in frame.columns:
        available = ', '.join(map(str, frame.columns)) or '<none>'
        raise PluginError(f'Column {key!r} not in {path.name}. Available columns: {available}.')
    return frame[key]

def _json_df(path: Path, key: str | None):
    from ..io.msgpack import frame_from_data, get_nested_value

    with path.open('r', encoding='utf-8') as fh:
        data = get_nested_value(json.load(fh), key)
    return frame_from_data(data)

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
