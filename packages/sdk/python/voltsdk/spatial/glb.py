from __future__ import annotations

import array
import json
import os
import struct
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import volt_spatial_assembler as _native

from .colors import _DEFAULT_MESH_MATERIAL

Pathish = str | os.PathLike[str]

def encode_point_cloud(
    positions: list[float],
    colors: list[float],
    bounds: tuple[Sequence[float], Sequence[float]],
) -> bytes:
    if not positions:
        return empty_glb()
    pos = array.array('f', positions)
    col = array.array('f', colors)
    return _native.point_cloud_glb(pos, col, _doubles(bounds[0]), _doubles(bounds[1]))

def encode_mesh(
    positions: list[float],
    normals: list[float],
    indices: list[int],
    *,
    bounds: tuple[Sequence[float], Sequence[float]],
    material: Mapping[str, Any] | None,
    colors: list[float] | None = None,
) -> bytes:
    if not positions or not indices:
        return empty_glb()

    mat = {**_DEFAULT_MESH_MATERIAL, **(material or {})}
    vertex_count = len(positions) // 3

    native_colors = None
    if colors:
        native_colors = array.array('f', _ensure_vec4(colors, vertex_count))

    flat_bounds = _doubles(bounds[0]) + _doubles(bounds[1])
    return _native.mesh_glb(
        array.array('f', positions),
        array.array('f', normals),
        array.array('I', indices),
        flat_bounds,
        _doubles(mat['baseColor']),
        float(mat['metallic']),
        float(mat['roughness']),
        _doubles(mat['emissive']),
        bool(mat['doubleSided']),
        native_colors,
    )

def empty_glb() -> bytes:
    document = {
        'asset': {'version': '2.0'},
        'scene': 0,
        'scenes': [{'nodes': []}],
        'nodes': [],
        'meshes': [],
        'buffers': [{'byteLength': 0}],
        'bufferViews': [],
        'accessors': [],
        'materials': [],
    }
    json_chunk = json.dumps(document, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
    padding = (-len(json_chunk)) % 4
    json_chunk += b' ' * padding
    total_length = 12 + 8 + len(json_chunk)
    return b''.join([
        struct.pack('<III', 0x46546C67, 2, total_length),
        struct.pack('<I4s', len(json_chunk), b'JSON'),
        json_chunk,
    ])

def write_output(payload: bytes, output_path: Pathish | None) -> bytes | Path:
    if output_path is None:
        return payload

    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return path

def _doubles(values: Sequence[float]) -> list[float]:
    return [float(value) for value in values]

def _ensure_vec4(colors: list[float], vertex_count: int) -> list[float]:
    if len(colors) == vertex_count * 4:
        return colors
    if len(colors) == vertex_count * 3:
        out: list[float] = []
        for index in range(vertex_count):
            base = index * 3
            out.extend((colors[base], colors[base + 1], colors[base + 2], 1.0))
        return out
    raise ValueError('Vertex color count does not match vertex count.')
