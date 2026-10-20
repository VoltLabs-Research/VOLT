from __future__ import annotations

import json
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import msgpack

from ..io.msgpack import merged_chunked_value
from .helpers import _is_vector

_EXPORTERS = ('AtomisticExporter', 'MeshExporter', 'LineExporter')

def _resolve_export_payload(source: Any, exporter_name: str) -> Any:
    payload = _load_payload(source)
    resolved = _resolve_export_payload_from_payload(payload, exporter_name)
    if resolved is not None:
        return resolved
    raise ValueError(f'Could not resolve {exporter_name} payload from source.')

def _resolve_any_export_payload(source: Any, exporter: str | None) -> tuple[str, Any]:
    payload = _load_payload(source)
    if exporter is not None:
        if exporter not in _EXPORTERS:
            raise ValueError(f'Unsupported exporter {exporter!r}; expected one of {_EXPORTERS}.')
        resolved = _resolve_export_payload_from_payload(payload, exporter)
        if resolved is not None:
            return exporter, resolved
        raise ValueError(f'Could not resolve {exporter} payload from source.')

    for exporter_name in _EXPORTERS:
        resolved = _resolve_export_payload_from_payload(payload, exporter_name)
        if resolved is not None:
            return exporter_name, resolved
    raise ValueError('Could not infer a supported export payload from source.')

def _resolve_export_payload_from_payload(payload: Any, exporter_name: str) -> Any | None:
    if exporter_name == 'AtomisticExporter' and _is_atomistic_export(payload):
        return payload
    if exporter_name == 'MeshExporter' and _is_mesh_export(payload):
        return payload
    if exporter_name == 'LineExporter' and _is_line_export(payload):
        return payload

    if isinstance(payload, Mapping):
        export_section = payload.get('export')
        if isinstance(export_section, Mapping):
            export_payload = export_section.get(exporter_name)
            if exporter_name == 'AtomisticExporter' and _is_atomistic_export(export_payload):
                return export_payload
            if exporter_name == 'MeshExporter' and _is_mesh_export(export_payload):
                return export_payload
            if exporter_name == 'LineExporter' and _is_line_export(export_payload):
                return export_payload
    return None

def _load_payload(source: Any) -> Any:
    if isinstance(source, Mapping):
        return dict(source)
    if isinstance(source, list):
        return source
    if isinstance(source, (str, os.PathLike)):
        path = Path(source).expanduser().resolve()
        if not path.is_file():
            raise FileNotFoundError(f'File not found: {path}')
        return _load_payload_file(path)
    raise TypeError(f'Unsupported SpatialAssembler source type: {type(source)!r}')

def _load_payload_file(path: Path) -> Any:
    suffix = path.suffix.lower()
    if suffix == '.json':
        with path.open('r', encoding='utf-8') as handle:
            return json.load(handle)
    if suffix == '.msgpack':
        merged: Any = None
        with path.open('rb') as handle:
            unpacker = msgpack.Unpacker(handle, raw=False)
            for message in unpacker:
                merged = merged_chunked_value(merged, message)
        return merged
    if suffix == '.parquet':
        return _load_parquet_payload(path)
    raise ValueError(f'Unsupported payload format: {path.suffix or "<none>"}')

def _load_parquet_payload(path: Path) -> Any:
    import pyarrow.parquet as pq

    table = pq.read_table(path)
    if 'id' not in table.column_names or 'points' not in table.column_names:
        raise ValueError(
            f'Parquet payload {path.name!r} is not a line entity table (expected id and points columns).'
        )
    return {'lines': table.to_pylist()}

def _is_atomistic_export(value: Any) -> bool:
    if not isinstance(value, Mapping) or not value:
        return False
    found_atoms = False
    for atoms in value.values():
        if not isinstance(atoms, list):
            return False
        if not atoms:
            continue
        first = atoms[0]
        if not isinstance(first, Mapping) or not _is_vector(first.get('pos'), 3):
            return False
        found_atoms = True
    return found_atoms

def _is_mesh_export(value: Any) -> bool:
    return isinstance(value, Mapping) and isinstance(value.get('vertices'), list) and isinstance(value.get('facets'), list)

def _is_line_export(value: Any) -> bool:
    return isinstance(value, Mapping) and isinstance(value.get('lines'), list)
