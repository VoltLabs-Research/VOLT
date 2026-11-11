from __future__ import annotations

import array
import os
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import volt_spatial_assembler as _native

from .colors import _DEFAULT_MESH_MATERIAL

Pathish = str | os.PathLike[str]

# The glTF binaries VOLT stores: positions on a uniform grid of POSITION_STEP angstrom, RGBA8
# colours, meshopt-compressed. Points keep the order they are given in.
POSITION_STEP: float = _native.POSITION_STEP

def encode_point_cloud(positions: list[float], colors: list[float] | None) -> bytes:
    """Point cloud; colors are RGB or RGBA in [0, 1], one per point, or None for white points."""
    return _native.encode_point_cloud(
        array.array('f', positions),
        array.array('f', colors) if colors else None,
    )

def encode_mesh(
    positions: list[float],
    normals: list[float],
    indices: list[int],
    *,
    material: Mapping[str, Any] | None,
    colors: list[float] | None = None,
) -> bytes:
    """Indexed triangle mesh; triangles keep their order. colors: RGB or RGBA in [0, 1] per vertex."""
    return _native.encode_mesh(
        array.array('f', positions),
        array.array('f', normals),
        array.array('I', indices),
        array.array('f', colors) if colors else None,
        {**_DEFAULT_MESH_MATERIAL, **(material or {})},
    )

def empty_glb() -> bytes:
    """A valid model with nothing in it."""
    return _native.encode_point_cloud(array.array('f'))

def write_output(payload: bytes, output_path: Pathish | None) -> bytes | Path:
    if output_path is None:
        return payload

    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return path
