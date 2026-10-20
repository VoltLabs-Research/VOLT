from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from .colors import _DEFAULT_LINE_MATERIAL
from .geometry import (
    _build_point_cloud_data,
    _compute_bounds,
    _compute_normals,
    _process_lines,
    _process_mesh_export,
)
from .glb import Pathish, empty_glb, encode_mesh, encode_point_cloud, write_output
from .helpers import _flatten_color_data, _flatten_index_data, _flatten_vector_data
from .payloads import _resolve_any_export_payload, _resolve_export_payload

class SpatialAssembler:

    def glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
        exporter: str | None = None,
        **options: Any,
    ) -> bytes | Path:
        exporter_name, export_data = _resolve_any_export_payload(source, exporter)
        if exporter_name == 'AtomisticExporter':
            return self.atomistic_glb(export_data, output_path=output_path)
        if exporter_name == 'MeshExporter':
            return self.mesh_glb(export_data, output_path=output_path, **options)
        if exporter_name == 'LineExporter':
            return self.lines_glb(export_data, output_path=output_path, **options)
        raise ValueError(f'Unsupported exporter: {exporter_name}')

    def atomistic_glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
    ) -> bytes | Path:
        export_data = _resolve_export_payload(source, 'AtomisticExporter')
        point_cloud = _build_point_cloud_data(export_data)
        if point_cloud is None:
            return write_output(empty_glb(), output_path)

        payload = self.generate_point_cloud_glb(
            point_cloud['positions'],
            point_cloud['colors'],
            bounds=(point_cloud['min'], point_cloud['max']),
        )
        return write_output(payload, output_path)

    def mesh_glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
        material: Mapping[str, Any] | None = None,
        enable_double_sided: bool = True,
    ) -> bytes | Path:
        export_data = _resolve_export_payload(source, 'MeshExporter')
        processed = _process_mesh_export(export_data)
        if processed is None:
            return write_output(empty_glb(), output_path)

        positions = processed['positions']
        indices = processed['indices']
        normals = _compute_normals(positions, indices)
        bounds = _compute_bounds(positions)
        payload = self.generate_mesh_glb(
            positions,
            normals,
            indices,
            bounds=bounds,
            material={**(material or {}), 'doubleSided': enable_double_sided},
        )
        return write_output(payload, output_path)

    def lines_glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
        line_width: float = 0.8,
        tubular_segments: int = 12,
        min_line_points: int = 2,
        material: Mapping[str, Any] | None = None,
        color_by: str | None = None,
        property_colors: Mapping[str, Sequence[float]] | None = None,
    ) -> bytes | Path:
        export_data = _resolve_export_payload(source, 'LineExporter')
        geometry = _process_lines(
            export_data,
            line_width=line_width,
            tubular_segments=tubular_segments,
            min_line_points=min_line_points,
            color_by=color_by,
            property_colors=property_colors,
        )
        if geometry is None:
            return write_output(empty_glb(), output_path)

        payload = self.generate_mesh_glb(
            geometry['positions'],
            geometry['normals'],
            geometry['indices'],
            colors=geometry['colors'],
            bounds=(geometry['min'], geometry['max']),
            material={**_DEFAULT_LINE_MATERIAL, **(material or {})},
        )
        return write_output(payload, output_path)

    def generate_point_cloud_glb(
        self,
        positions: Sequence[float] | Sequence[Sequence[float]],
        colors: Sequence[float] | Sequence[Sequence[float]],
        *,
        bounds: tuple[Sequence[float], Sequence[float]] | None = None,
    ) -> bytes:
        flat_positions = _flatten_vector_data(positions, 3)
        if not flat_positions:
            return empty_glb()

        vertex_count = len(flat_positions) // 3
        flat_colors = _flatten_vector_data(colors, 3)
        if len(flat_colors) != vertex_count * 3:
            raise ValueError('Point cloud colors must contain exactly 3 values per vertex.')

        min_bound, max_bound = bounds or _compute_bounds(flat_positions)
        return encode_point_cloud(flat_positions, flat_colors, (min_bound, max_bound))

    def generate_mesh_glb(
        self,
        positions: Sequence[float] | Sequence[Sequence[float]],
        normals: Sequence[float] | Sequence[Sequence[float]],
        indices: Sequence[int] | Sequence[Sequence[int]],
        *,
        colors: Sequence[float] | Sequence[Sequence[float]] | None = None,
        bounds: tuple[Sequence[float], Sequence[float]] | None = None,
        material: Mapping[str, Any] | None = None,
    ) -> bytes:
        flat_positions = _flatten_vector_data(positions, 3)
        flat_normals = _flatten_vector_data(normals, 3)
        flat_indices = _flatten_index_data(indices)
        if not flat_positions or not flat_indices:
            return empty_glb()
        if len(flat_positions) != len(flat_normals):
            raise ValueError('Mesh positions and normals must contain the same number of floats.')

        flat_colors: list[float] | None = None
        if colors is not None:
            flat_colors = _flatten_color_data(colors)

        min_bound, max_bound = bounds or _compute_bounds(flat_positions)
        return encode_mesh(
            flat_positions,
            flat_normals,
            flat_indices,
            bounds=(min_bound, max_bound),
            material=material,
            colors=flat_colors,
        )
