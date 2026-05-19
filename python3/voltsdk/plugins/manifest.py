"""Lightweight parser for ``plugin.json`` workflow manifests."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Argument:
    name: str
    type: str
    default: Any = None
    label: str = ""
    options: tuple[str, ...] = ()
    required: bool = False


@dataclass(frozen=True)
class Output:
    name: str
    suffix: str
    cli_flag: str | None = None


@dataclass(frozen=True)
class Manifest:
    """Subset of ``plugin.json`` relevant to the Python client."""

    key: str
    name: str
    version: str
    description: str = ""
    binary: str = ""
    entrypoint_script: str = ""
    arguments: tuple[Argument, ...] = ()
    inputs: tuple[Output, ...] = ()
    outputs: tuple[Output, ...] = ()
    exposures: tuple[str, ...] = ()
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def load(cls, path: str | Path) -> "Manifest":
        path = Path(path)
        return cls.parse(json.loads(path.read_text(encoding="utf-8")))

    @classmethod
    def parse(cls, data: dict[str, Any]) -> "Manifest":
        nodes = _nodes(data)
        modifier = _node(nodes, "modifier", "modifier")
        entrypoint = _node(nodes, "entrypoint", "entrypoint")
        arguments = _arguments(_node(nodes, "arguments", "arguments"))
        inputs = _outputs(entrypoint.get("inputs"))
        outputs = _outputs(entrypoint.get("outputs"))
        exposures = tuple(
            node["data"]["exposure"]["results"]
            for node in nodes
            if node.get("type") == "exposure"
            and isinstance(node.get("data", {}).get("exposure"), dict)
            and isinstance(node["data"]["exposure"].get("results"), str)
        )
        return cls(
            key=str(modifier.get("key", "")),
            name=str(modifier.get("name", modifier.get("key", ""))),
            version=str(modifier.get("version", "")),
            description=str(modifier.get("description", "")),
            binary=_binary(entrypoint),
            entrypoint_script=str(entrypoint.get("entrypointScript", "")),
            arguments=arguments,
            inputs=inputs,
            outputs=outputs,
            exposures=exposures,
            raw=data,
        )


def _nodes(data: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = data.get("workflow", {}).get("nodes", [])
    return nodes if isinstance(nodes, list) else []


def _node(nodes: list[dict[str, Any]], node_type: str, data_key: str) -> dict[str, Any]:
    for node in nodes:
        if node.get("type") == node_type:
            value = node.get("data", {}).get(data_key, {})
            if isinstance(value, dict):
                return value
    return {}


def _arguments(payload: dict[str, Any]) -> tuple[Argument, ...]:
    raw = payload.get("arguments", []) if isinstance(payload, dict) else []
    if not isinstance(raw, list):
        return ()
    result: list[Argument] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        options = tuple(
            option["key"] for option in entry.get("options", []) if isinstance(option, dict) and "key" in option
        )
        result.append(
            Argument(
                name=str(entry.get("argument", "")),
                type=str(entry.get("type", "string")),
                default=entry.get("default"),
                label=str(entry.get("label", "")),
                options=options,
                required=bool(entry.get("required", False)),
            )
        )
    return tuple(result)


def _outputs(payload: Any) -> tuple[Output, ...]:
    if not isinstance(payload, list):
        return ()
    result: list[Output] = []
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        result.append(
            Output(
                name=str(entry.get("name", "")),
                suffix=str(entry.get("sourceSuffix", "")),
                cli_flag=entry.get("cliFlag"),
            )
        )
    return tuple(result)


def _binary(entrypoint: dict[str, Any]) -> str:
    script = str(entrypoint.get("entrypointScript", ""))
    if script.startswith("bin/"):
        return Path(script).name
    binary = str(entrypoint.get("binaryFileName") or entrypoint.get("binary") or "")
    for suffix in ("-plugin.zip", ".zip"):
        if binary.endswith(suffix):
            return binary[: -len(suffix)]
    return Path(binary).stem if binary else ""
