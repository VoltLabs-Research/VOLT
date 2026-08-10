from __future__ import annotations

import hashlib
import inspect
import json
import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Mapping, Sequence

from .errors import PluginError

INTERFACE_VERSION = 2
DESCRIPTOR_VERSION = 1

MANIFEST_NAME = 'plugin.json'

_SCALAR_TYPES = frozenset({'bool', 'int', 'float', 'string', 'enum', 'path', 'path-list'})

@dataclass(frozen=True)
class Param:
    name: str
    flag: str
    type: str
    help: str = ''
    default: str | None = None
    values: tuple[str, ...] = ()
    bundle_default: str | None = None

@dataclass(frozen=True)
class Requirement:
    id: str
    capability: str
    bind: Mapping[str, str]
    required: bool = True
    multiple: bool = False

@dataclass(frozen=True)
class InputSpec:
    requirement: str | None = None
    port: str | None = None

@dataclass(frozen=True)
class PluginInterface:
    input: InputSpec
    requires: tuple[Requirement, ...]
    provides: Mapping[str, Mapping[str, str]]
    params: Mapping[str, Param]

    @property
    def param_names(self) -> tuple[str, ...]:
        return tuple(self.params)

def load_interface(root: str | os.PathLike[str], *, plugin_key: str) -> PluginInterface:
    manifest_path = Path(root) / MANIFEST_NAME
    if not manifest_path.is_file():
        raise PluginError(
            f'{plugin_key} has no {MANIFEST_NAME} at {manifest_path}. '
            f'Every plugin must ship an interface manifest.'
        )
    try:
        with manifest_path.open('r', encoding='utf-8') as fh:
            manifest = json.load(fh)
    except ValueError as error:
        raise PluginError(f'{plugin_key}: {MANIFEST_NAME} is not valid JSON: {error}') from error

    interface = manifest.get('interface')
    if not isinstance(interface, dict):
        raise PluginError(
            f'{plugin_key}: {MANIFEST_NAME} has no "interface" block. '
            f'Rebuild the plugin against interface version {INTERFACE_VERSION}.'
        )

    version = interface.get('version')
    if version != INTERFACE_VERSION:
        raise PluginError(
            f'{plugin_key}: interface version {version!r} is not supported '
            f'(this SDK speaks version {INTERFACE_VERSION}).'
        )

    requires = _parse_requires(interface.get('requires'), plugin_key)
    provides = _parse_provides(interface.get('provides'), plugin_key)
    options = _parse_params(interface.get('params'), plugin_key)
    input_spec = _parse_input(interface.get('input'), requires, plugin_key)
    params = _user_facing_params(options, requires, plugin_key)

    return PluginInterface(input=input_spec, requires=requires, provides=provides, params=params)

def _parse_requires(raw: Any, plugin_key: str) -> tuple[Requirement, ...]:
    if raw is None:
        return ()
    if not isinstance(raw, list):
        raise PluginError(f'{plugin_key}: interface.requires must be a list.')

    requirements: list[Requirement] = []
    seen: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            raise PluginError(f'{plugin_key}: each interface.requires entry must be an object.')
        requirement_id = entry.get('id')
        capability = entry.get('capability')
        if not isinstance(requirement_id, str) or not requirement_id:
            raise PluginError(f'{plugin_key}: interface.requires entry is missing "id".')
        if not isinstance(capability, str) or not capability:
            raise PluginError(f'{plugin_key}: requirement {requirement_id!r} is missing "capability".')
        if requirement_id in seen:
            raise PluginError(f'{plugin_key}: duplicate requirement id {requirement_id!r}.')
        seen.add(requirement_id)

        bind_raw = entry.get('bind') or {}
        if not isinstance(bind_raw, dict):
            raise PluginError(f'{plugin_key}: requirement {requirement_id!r} has a non-object "bind".')
        bind: dict[str, str] = {}
        for port, flag in bind_raw.items():
            if not isinstance(port, str) or not isinstance(flag, str) or not flag.startswith('--'):
                raise PluginError(
                    f'{plugin_key}: requirement {requirement_id!r} binds port {port!r} to {flag!r}; '
                    f'expected a "--flag" string.'
                )
            bind[port] = flag

        requirements.append(Requirement(
            id=requirement_id,
            capability=capability,
            bind=bind,
            required=bool(entry.get('required', True)),
            multiple=bool(entry.get('multiple', False)),
        ))
    return tuple(requirements)

def _parse_provides(raw: Any, plugin_key: str) -> Mapping[str, Mapping[str, str]]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise PluginError(f'{plugin_key}: interface.provides must be an object.')

    provides: dict[str, dict[str, str]] = {}
    for capability, ports in raw.items():
        if not isinstance(ports, dict) or not ports:
            raise PluginError(
                f'{plugin_key}: provides[{capability!r}] must map port names to artifact names.'
            )
        for port, artifact in ports.items():
            if not isinstance(port, str) or not isinstance(artifact, str) or not artifact:
                raise PluginError(
                    f'{plugin_key}: provides[{capability!r}][{port!r}] must be an artifact name.'
                )
        provides[capability] = dict(ports)
    return provides

def _parse_params(raw: Any, plugin_key: str) -> Mapping[str, Param]:
    if not isinstance(raw, dict):
        raise PluginError(
            f'{plugin_key}: interface.params is missing. It is generated by '
            f'`vpm publish` from `<binary> --describe`.'
        )
    descriptor = raw.get('descriptor')
    if descriptor != DESCRIPTOR_VERSION:
        raise PluginError(
            f'{plugin_key}: parameter descriptor version {descriptor!r} is not supported '
            f'(this SDK speaks version {DESCRIPTOR_VERSION}).'
        )
    options = raw.get('options')
    if not isinstance(options, list):
        raise PluginError(f'{plugin_key}: interface.params.options must be a list.')

    checksum = raw.get('checksum')
    if not isinstance(checksum, str) or not checksum:
        raise PluginError(f'{plugin_key}: interface.params.checksum is missing.')
    actual = params_checksum(options)
    if actual != checksum:
        raise PluginError(
            f'{plugin_key}: interface.params.checksum does not match its options '
            f'(expected {checksum}, computed {actual}). The parameter table is generated '
            f'from `<binary> --describe`; re-publish the plugin instead of editing it.'
        )

    params: dict[str, Param] = {}
    for option in options:
        param = _parse_param(option, plugin_key)
        if param.name in params:
            raise PluginError(f'{plugin_key}: duplicate parameter {param.name!r}.')
        params[param.name] = param
    return params

def _parse_param(raw: Any, plugin_key: str) -> Param:
    if not isinstance(raw, dict):
        raise PluginError(f'{plugin_key}: each interface.params option must be an object.')
    flag = raw.get('flag')
    if not isinstance(flag, str) or not flag.startswith('--') or len(flag) < 3:
        raise PluginError(f'{plugin_key}: option flag {flag!r} must look like "--name".')
    option_type = raw.get('type')
    if option_type not in _SCALAR_TYPES:
        raise PluginError(
            f'{plugin_key}: option {flag} has unsupported type {option_type!r} '
            f'(known: {", ".join(sorted(_SCALAR_TYPES))}).'
        )
    values = raw.get('values') or ()
    if not isinstance(values, (list, tuple)) or not all(isinstance(v, str) for v in values):
        raise PluginError(f'{plugin_key}: option {flag} has a malformed "values" domain.')
    if option_type == 'enum' and not values:
        raise PluginError(f'{plugin_key}: option {flag} is an enum with no values.')

    default = raw.get('default')
    if default is not None and not isinstance(default, str):
        raise PluginError(f'{plugin_key}: option {flag} has a non-string default {default!r}.')
    bundle_default = raw.get('bundleDefault')
    if bundle_default is not None and not isinstance(bundle_default, str):
        raise PluginError(f'{plugin_key}: option {flag} has a non-string bundleDefault.')

    return Param(
        name=param_name(flag),
        flag=flag,
        type=option_type,
        help=str(raw.get('help') or ''),
        default=default,
        values=tuple(values),
        bundle_default=bundle_default,
    )

def _parse_input(raw: Any, requires: Sequence[Requirement], plugin_key: str) -> InputSpec:
    if raw is None:
        return InputSpec()
    if not isinstance(raw, dict):
        raise PluginError(f'{plugin_key}: interface.input must be an object.')

    requirement_id = raw.get('from')
    port = raw.get('port')
    if requirement_id is None and port is None:
        return InputSpec()
    if not isinstance(requirement_id, str) or not isinstance(port, str):
        raise PluginError(
            f'{plugin_key}: interface.input must name both "from" (a requirement id) and "port".'
        )

    match = next((r for r in requires if r.id == requirement_id), None)
    if match is None:
        raise PluginError(
            f'{plugin_key}: interface.input reads requirement {requirement_id!r}, '
            f'which is not declared in interface.requires.'
        )
    if port in match.bind:
        raise PluginError(
            f'{plugin_key}: port {port!r} feeds the positional input and is also bound to '
            f'{match.bind[port]}. It must do one or the other.'
        )
    return InputSpec(requirement=requirement_id, port=port)

def _user_facing_params(
    options: Mapping[str, Param],
    requires: Sequence[Requirement],
    plugin_key: str,
) -> Mapping[str, Param]:
    wired: dict[str, str] = {}
    for requirement in requires:
        for port, flag in requirement.bind.items():
            if flag in wired:
                raise PluginError(
                    f'{plugin_key}: flag {flag} is bound twice ({wired[flag]} and '
                    f'{requirement.id}.{port}).'
                )
            wired[flag] = f'{requirement.id}.{port}'

    by_flag = {param.flag: param for param in options.values()}
    for flag, origin in wired.items():
        if flag not in by_flag:
            raise PluginError(
                f'{plugin_key}: {origin} is bound to {flag}, which the plugin does not accept. '
                f'It accepts: {", ".join(sorted(by_flag)) or "<nothing>"}.'
            )

    return {
        name: param for name, param in options.items() if param.flag not in wired
    }

def param_name(flag: str) -> str:
    return flag[2:].replace('-', '_')

def params_checksum(options: Sequence[Any]) -> str:
    canonical = json.dumps(options, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    return 'sha256:' + hashlib.sha256(canonical.encode('utf-8')).hexdigest()

def coerce_param(param: Param, value: Any) -> str:
    if isinstance(value, Enum):
        value = value.value

    if param.type == 'bool':
        if isinstance(value, bool):
            return 'true' if value else 'false'
        if isinstance(value, str) and value.lower() in {'true', 'false'}:
            return value.lower()
        raise PluginError(f'{param.name} expects a bool, got {value!r}.')

    if param.type == 'int':
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise PluginError(f'{param.name} expects an int, got {value!r}.')
        try:
            return str(int(value))
        except ValueError as error:
            raise PluginError(f'{param.name} expects an int, got {value!r}.') from error

    if param.type == 'float':
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise PluginError(f'{param.name} expects a number, got {value!r}.')
        try:
            return repr(float(value))
        except ValueError as error:
            raise PluginError(f'{param.name} expects a number, got {value!r}.') from error

    if param.type == 'enum':
        return _coerce_enum(param, value)

    if param.type in {'path', 'path-list'}:
        if isinstance(value, (list, tuple)):
            return ','.join(os.fspath(item) for item in value)
        return os.fspath(value)

    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, separators=(',', ':'), ensure_ascii=True)
    return str(value)

def _coerce_enum(param: Param, value: Any) -> str:
    if not isinstance(value, str):
        raise PluginError(
            f'{param.name} expects one of {", ".join(param.values)}, got {value!r}.'
        )
    for candidate in param.values:
        if candidate.lower() == value.lower():
            return candidate
    raise PluginError(
        f'{param.name}={value!r} is not one of {", ".join(param.values)}.'
    )

def build_signature(interface: PluginInterface) -> inspect.Signature:
    parameters = [
        inspect.Parameter('source', inspect.Parameter.POSITIONAL_ONLY),
        inspect.Parameter('output_dir', inspect.Parameter.KEYWORD_ONLY, default=None),
        inspect.Parameter('output_name', inspect.Parameter.KEYWORD_ONLY, default=None),
        inspect.Parameter('timeout', inspect.Parameter.KEYWORD_ONLY, default=None),
    ]
    for requirement in interface.requires:
        if requirement.id == interface.input.requirement:
            continue
        parameters.append(inspect.Parameter(
            requirement.id, inspect.Parameter.KEYWORD_ONLY, default=None,
        ))
    for param in interface.params.values():
        parameters.append(inspect.Parameter(
            param.name,
            inspect.Parameter.KEYWORD_ONLY,
            default=param.default if param.default is not None else None,
        ))
    return inspect.Signature(parameters)

def describe_interface(interface: PluginInterface, plugin_key: str, version: str) -> str:
    lines = [f'{plugin_key} {version}', '']
    if interface.requires:
        lines.append('Requires:')
        for requirement in interface.requires:
            suffix = ' (optional)' if not requirement.required else ''
            plural = ', accepts several' if requirement.multiple else ''
            lines.append(f'  {requirement.id}: {requirement.capability}{suffix}{plural}')
        lines.append('')
    if interface.provides:
        lines.append('Provides:')
        for capability, ports in interface.provides.items():
            lines.append(f'  {capability}: {", ".join(sorted(ports))}')
        lines.append('')
    if interface.params:
        lines.append('Parameters:')
        for param in interface.params.values():
            detail = param.type
            if param.values:
                detail = '|'.join(param.values)
            if param.default is not None:
                detail += f' = {param.default}'
            lines.append(f'  {param.name} ({detail})')
            if param.help:
                lines.append(f'      {param.help}')
    return '\n'.join(lines)
