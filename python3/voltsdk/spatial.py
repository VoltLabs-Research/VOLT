"""Python-side SpatialAssembler API for Volt export payloads."""

from __future__ import annotations

import json
import math
import os
import struct
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import msgpack

from .io.msgpack import merged_chunked_value

Pathish = str | os.PathLike[str]

_DEFAULT_MESH_MATERIAL = {
    'baseColor': [0.8, 0.8, 0.85, 1.0],
    'metallic': 0.05,
    'roughness': 0.9,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_DEFAULT_DISLOCATION_MATERIAL = {
    'baseColor': [1.0, 0.5, 0.0, 1.0],
    'metallic': 0.0,
    'roughness': 0.8,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_DISLOCATION_TYPE_COLORS = {
    'Other': [0.95, 0.1, 0.1, 1.0],
    '1/2<111>': [0.1, 0.9, 0.1, 1.0],
    '<100>': [1.0, 0.45, 0.74, 1.0],
    '<110>': [0.1, 0.7, 0.95, 1.0],
    '<111>': [0.95, 0.9, 0.1, 1.0],
    '1/6<112>': [0.9, 0.5, 0.1, 1.0],
}

_EXTENDED_PALETTE = [
    [0.91, 0.30, 0.24],
    [0.20, 0.60, 0.86],
    [0.18, 0.80, 0.44],
    [0.95, 0.77, 0.06],
    [0.61, 0.35, 0.71],
    [1.00, 0.50, 0.00],
    [0.00, 0.81, 0.82],
    [0.85, 0.20, 0.53],
    [0.55, 0.76, 0.22],
    [0.36, 0.25, 0.60],
    [1.00, 0.62, 0.47],
    [0.00, 0.50, 0.50],
    [0.80, 0.68, 0.00],
    [0.44, 0.68, 0.28],
    [0.69, 0.19, 0.38],
    [0.30, 0.75, 0.93],
    [0.90, 0.56, 0.67],
    [0.50, 0.50, 0.00],
    [0.00, 0.39, 0.74],
    [0.75, 0.94, 0.27],
    [0.58, 0.00, 0.83],
    [0.94, 0.42, 0.31],
    [0.27, 0.94, 0.94],
    [0.66, 0.47, 0.33],
]


class SpatialAssembler:
    """Build GLBs from Volt exporter payloads."""

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
        if exporter_name == 'DislocationExporter':
            return self.dislocations_glb(export_data, output_path=output_path, **options)
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
            return _write_output(_build_empty_glb(), output_path)

        payload = self.generate_point_cloud_glb(
            point_cloud['positions'],
            point_cloud['colors'],
            bounds=(point_cloud['min'], point_cloud['max']),
        )
        return _write_output(payload, output_path)

    def mesh_glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
        material: Mapping[str, Any] | None = None,
        enable_double_sided: bool = True,
        smooth_iterations: int | None = None,
    ) -> bytes | Path:
        export_data = _resolve_export_payload(source, 'MeshExporter')
        processed = _process_mesh_export(export_data)
        if processed is None:
            return _write_output(_build_empty_glb(), output_path)

        positions = processed['positions']
        indices = processed['indices']
        if smooth_iterations and smooth_iterations > 0:
            positions = self.taubin_smooth(positions, indices, smooth_iterations)

        normals = _compute_normals(positions, indices)
        bounds = _compute_bounds(positions)
        payload = self.generate_mesh_glb(
            positions,
            normals,
            indices,
            bounds=bounds,
            material=_normalize_material(material, enable_double_sided=enable_double_sided),
        )
        return _write_output(payload, output_path)

    def dislocations_glb(
        self,
        source: Any,
        *,
        output_path: Pathish | None = None,
        line_width: float = 0.8,
        tubular_segments: int = 12,
        min_segment_points: int = 2,
        material: Mapping[str, Any] | None = None,
        color_by_type: bool = True,
        type_colors: Mapping[str, Sequence[float]] | None = None,
    ) -> bytes | Path:
        export_data = _resolve_export_payload(source, 'DislocationExporter')
        geometry = _process_dislocations(
            export_data,
            line_width=line_width,
            tubular_segments=tubular_segments,
            min_segment_points=min_segment_points,
            color_by_type=color_by_type,
            type_colors=type_colors,
        )
        if geometry is None:
            return _write_output(_build_empty_glb(), output_path)

        payload = self.generate_mesh_glb(
            geometry['positions'],
            geometry['normals'],
            geometry['indices'],
            colors=geometry['colors'],
            bounds=(geometry['min'], geometry['max']),
            material=_normalize_material(material, defaults=_DEFAULT_DISLOCATION_MATERIAL),
        )
        return _write_output(payload, output_path)

    def generate_point_cloud_glb(
        self,
        positions: Sequence[float] | Sequence[Sequence[float]],
        colors: Sequence[float] | Sequence[Sequence[float]],
        *,
        bounds: tuple[Sequence[float], Sequence[float]] | None = None,
    ) -> bytes:
        flat_positions = _flatten_vector_data(positions, 3)
        if not flat_positions:
            return _build_empty_glb()

        vertex_count = len(flat_positions) // 3
        flat_colors = _flatten_vector_data(colors, 3)
        if len(flat_colors) != vertex_count * 3:
            raise ValueError('Point cloud colors must contain exactly 3 values per vertex.')

        min_bound, max_bound = bounds or _compute_bounds(flat_positions)
        return _build_mesh_like_glb(
            positions=flat_positions,
            normals=None,
            indices=None,
            colors=flat_colors,
            position_bounds=(list(min_bound), list(max_bound)),
            material={
                'baseColor': [1.0, 1.0, 1.0, 1.0],
                'metallic': 0.0,
                'roughness': 1.0,
                'emissive': [0.0, 0.0, 0.0],
                'doubleSided': False,
            },
            mode=0,
            unlit=True,
        )

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
            return _build_empty_glb()
        if len(flat_positions) != len(flat_normals):
            raise ValueError('Mesh positions and normals must contain the same number of floats.')

        flat_colors: list[float] | None = None
        if colors is not None:
            flat_colors = _flatten_color_data(colors, len(flat_positions) // 3)

        min_bound, max_bound = bounds or _compute_bounds(flat_positions)
        return _build_mesh_like_glb(
            positions=flat_positions,
            normals=flat_normals,
            indices=flat_indices,
            colors=flat_colors,
            position_bounds=(list(min_bound), list(max_bound)),
            material=_normalize_material(material),
            mode=4,
            unlit=False,
        )

    def taubin_smooth(
        self,
        positions: Sequence[float] | Sequence[Sequence[float]],
        indices: Sequence[int] | Sequence[Sequence[int]],
        iterations: int,
        *,
        lam: float = 0.5,
        mu: float = -0.53,
    ) -> list[float]:
        flat_positions = _flatten_vector_data(positions, 3)
        flat_indices = _flatten_index_data(indices)
        if iterations <= 0 or not flat_positions or not flat_indices:
            return flat_positions

        vertex_count = len(flat_positions) // 3
        vertices = [
            [flat_positions[index * 3], flat_positions[index * 3 + 1], flat_positions[index * 3 + 2]]
            for index in range(vertex_count)
        ]
        neighbors = _build_vertex_neighbors(vertex_count, flat_indices)

        for _ in range(iterations):
            vertices = _laplacian_step(vertices, neighbors, lam)
            vertices = _laplacian_step(vertices, neighbors, mu)

        result: list[float] = []
        for vertex in vertices:
            result.extend(vertex)
        return result


def _resolve_export_payload(source: Any, exporter_name: str) -> Any:
    payload = _load_payload(source)
    resolved = _resolve_export_payload_from_payload(payload, exporter_name)
    if resolved is not None:
        return resolved
    raise ValueError(f'Could not resolve {exporter_name} payload from source.')


def _resolve_any_export_payload(source: Any, exporter: str | None) -> tuple[str, Any]:
    payload = _load_payload(source)
    if exporter is not None:
        exporter_name = _normalize_exporter_name(exporter)
        resolved = _resolve_export_payload_from_payload(payload, exporter_name)
        if resolved is not None:
            return exporter_name, resolved
        raise ValueError(f'Could not resolve {exporter_name} payload from source.')

    for exporter_name in ('AtomisticExporter', 'MeshExporter', 'DislocationExporter'):
        resolved = _resolve_export_payload_from_payload(payload, exporter_name)
        if resolved is not None:
            return exporter_name, resolved
    raise ValueError('Could not infer a supported export payload from source.')


def _resolve_export_payload_from_payload(payload: Any, exporter_name: str) -> Any | None:
    if exporter_name == 'AtomisticExporter' and _is_atomistic_export(payload):
        return payload
    if exporter_name == 'MeshExporter' and _is_mesh_export(payload):
        return payload
    if exporter_name == 'DislocationExporter' and _is_dislocation_export(payload):
        return payload

    if isinstance(payload, Mapping):
        export_section = payload.get('export')
        if isinstance(export_section, Mapping):
            export_payload = export_section.get(exporter_name)
            if exporter_name == 'AtomisticExporter' and _is_atomistic_export(export_payload):
                return export_payload
            if exporter_name == 'MeshExporter' and _is_mesh_export(export_payload):
                return export_payload
            if exporter_name == 'DislocationExporter' and _is_dislocation_export(export_payload):
                return export_payload
    return None


def _normalize_exporter_name(value: str) -> str:
    normalized = ''.join(character for character in value if character.isalnum()).lower()
    aliases = {
        'atomistic': 'AtomisticExporter',
        'atomisticexporter': 'AtomisticExporter',
        'mesh': 'MeshExporter',
        'meshexporter': 'MeshExporter',
        'dislocation': 'DislocationExporter',
        'dislocations': 'DislocationExporter',
        'dislocationexporter': 'DislocationExporter',
    }
    exporter_name = aliases.get(normalized)
    if exporter_name is None:
        raise ValueError(f'Unsupported exporter: {value!r}')
    return exporter_name


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
    raise ValueError(f'Unsupported payload format: {path.suffix or "<none>"}')


def _build_point_cloud_data(export_data: Mapping[str, Any]) -> dict[str, Any] | None:
    total_atoms = 0
    for atoms in export_data.values():
        if isinstance(atoms, list):
            total_atoms += len(atoms)
    if total_atoms == 0:
        return None

    positions: list[float] = []
    colors: list[float] = []
    min_bound = [math.inf, math.inf, math.inf]
    max_bound = [-math.inf, -math.inf, -math.inf]

    for entry_index, (type_name, atoms) in enumerate(export_data.items()):
        if not isinstance(atoms, list):
            continue
        fallback_color = _color_for_type(str(type_name), entry_index)
        for atom in atoms:
            if not isinstance(atom, Mapping):
                continue
            pos = atom.get('pos')
            if not _is_vector(pos, 3):
                continue
            x, y, z = float(pos[0]), float(pos[1]), float(pos[2])
            positions.extend([x, y, z])
            min_bound[0] = min(min_bound[0], x)
            min_bound[1] = min(min_bound[1], y)
            min_bound[2] = min(min_bound[2], z)
            max_bound[0] = max(max_bound[0], x)
            max_bound[1] = max(max_bound[1], y)
            max_bound[2] = max(max_bound[2], z)

            color = _color_for_atom(atom, fallback_color)
            colors.extend(color)

    if not positions:
        return None
    return {
        'positions': positions,
        'colors': colors,
        'min': min_bound,
        'max': max_bound,
    }


def _process_mesh_export(export_data: Mapping[str, Any]) -> dict[str, Any] | None:
    vertices = export_data.get('vertices')
    facets = export_data.get('facets')
    if not isinstance(vertices, list) or not isinstance(facets, list):
        return None

    positions: list[float] = []
    vertex_indices: dict[int, int] = {}
    for index, vertex in enumerate(vertices):
        if not isinstance(vertex, Mapping):
            continue
        original_index = vertex.get('index')
        position = vertex.get('position')
        if not isinstance(original_index, int) or not _is_vector(position, 3):
            continue
        positions.extend([float(position[0]), float(position[1]), float(position[2])])
        vertex_indices[original_index] = index

    indices: list[int] = []
    for facet in facets:
        if not isinstance(facet, Mapping):
            continue
        raw_vertices = facet.get('vertices')
        if not _is_vector(raw_vertices, 3):
            continue
        resolved = []
        for raw_index in raw_vertices:
            if not isinstance(raw_index, int):
                resolved = []
                break
            mapped = vertex_indices.get(raw_index)
            if mapped is None:
                resolved = []
                break
            resolved.append(mapped)
        if len(resolved) == 3:
            indices.extend(resolved)

    if not positions or not indices:
        return None
    return {
        'positions': positions,
        'indices': indices,
    }


def _process_dislocations(
    export_data: Mapping[str, Any],
    *,
    line_width: float,
    tubular_segments: int,
    min_segment_points: int,
    color_by_type: bool,
    type_colors: Mapping[str, Sequence[float]] | None,
) -> dict[str, Any] | None:
    segments = export_data.get('segments')
    if not isinstance(segments, list):
        return None

    resolved_type_colors = dict(_DISLOCATION_TYPE_COLORS)
    if type_colors:
        for key, value in type_colors.items():
            if _is_color(value):
                resolved_type_colors[str(key)] = [float(component) for component in value]

    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    colors: list[float] | None = [] if color_by_type else None
    min_bound = [math.inf, math.inf, math.inf]
    max_bound = [-math.inf, -math.inf, -math.inf]

    for segment in segments:
        if not isinstance(segment, Mapping):
            continue
        points = segment.get('points')
        if not isinstance(points, list) or len(points) < min_segment_points:
            continue
        geometry = _create_line_geometry(points, line_width, tubular_segments)
        if geometry is None:
            continue

        vertex_offset = len(positions) // 3
        positions.extend(geometry['positions'])
        normals.extend(geometry['normals'])
        indices.extend(index + vertex_offset for index in geometry['indices'])

        for index in range(0, len(geometry['positions']), 3):
            x = geometry['positions'][index]
            y = geometry['positions'][index + 1]
            z = geometry['positions'][index + 2]
            min_bound[0] = min(min_bound[0], x)
            min_bound[1] = min(min_bound[1], y)
            min_bound[2] = min(min_bound[2], z)
            max_bound[0] = max(max_bound[0], x)
            max_bound[1] = max(max_bound[1], y)
            max_bound[2] = max(max_bound[2], z)

        if colors is not None:
            dislocation_type = _calculate_dislocation_type(segment)
            color = resolved_type_colors.get(dislocation_type, resolved_type_colors['Other'])
            colors.extend(color for _ in range(len(geometry['positions']) // 3))

    if not positions or not indices:
        return None

    flat_colors = None
    if colors is not None:
        flat_colors = []
        for rgba in colors:
            flat_colors.extend(rgba)

    return {
        'positions': positions,
        'normals': normals,
        'indices': indices,
        'colors': flat_colors,
        'min': min_bound,
        'max': max_bound,
    }


def _create_line_geometry(
    points: Sequence[Any],
    line_width: float,
    tubular_segments: int,
) -> dict[str, list[float] | list[int]] | None:
    if len(points) < 2:
        return None

    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []

    for point_index in range(len(points) - 1):
        point_one = points[point_index]
        point_two = points[point_index + 1]
        if not _is_vector(point_one, 3) or not _is_vector(point_two, 3):
            continue

        direction = [
            float(point_two[0]) - float(point_one[0]),
            float(point_two[1]) - float(point_one[1]),
            float(point_two[2]) - float(point_one[2]),
        ]
        length = math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2)
        if length < 1e-10:
            continue

        direction = [component / length for component in direction]
        up = [1.0, 0.0, 0.0] if abs(direction[1]) > 0.99 else [0.0, 1.0, 0.0]
        right = _cross(direction, up)
        right_length = math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2)
        if right_length < 1e-10:
            continue
        right = [component / right_length for component in right]
        up = _cross(direction, right)

        base_vertex_index = len(positions) // 3
        radius = line_width * 0.5
        point_one_values = [float(point_one[0]), float(point_one[1]), float(point_one[2])]
        point_two_values = [float(point_two[0]), float(point_two[1]), float(point_two[2])]

        for segment_index in range(tubular_segments + 1):
            angle = (segment_index / tubular_segments) * math.pi * 2
            cosine = math.cos(angle)
            sine = math.sin(angle)
            offset = [
                (right[0] * cosine + up[0] * sine) * radius,
                (right[1] * cosine + up[1] * sine) * radius,
                (right[2] * cosine + up[2] * sine) * radius,
            ]
            normal_length = math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2)
            if normal_length > 1e-6:
                normal = [offset[0] / normal_length, offset[1] / normal_length, offset[2] / normal_length]
            else:
                normal = [0.0, 1.0, 0.0]

            positions.extend([
                point_one_values[0] + offset[0],
                point_one_values[1] + offset[1],
                point_one_values[2] + offset[2],
                point_two_values[0] + offset[0],
                point_two_values[1] + offset[1],
                point_two_values[2] + offset[2],
            ])
            normals.extend(normal + normal)

        for segment_index in range(tubular_segments):
            first = base_vertex_index + segment_index * 2
            second = first + 1
            third = base_vertex_index + (segment_index + 1) * 2
            fourth = third + 1
            indices.extend([first, second, third, third, second, fourth])

    if not positions or not indices:
        return None
    return {
        'positions': positions,
        'normals': normals,
        'indices': indices,
    }


def _calculate_dislocation_type(segment: Mapping[str, Any], tolerance: float = 1e-6) -> str:
    burgers = segment.get('burgers')
    if not isinstance(burgers, Mapping):
        return 'Other'
    vector = burgers.get('vector')
    if not _is_vector(vector, 3):
        return 'Other'

    bx, by, bz = [abs(float(component)) for component in vector]
    non_zero = [component for component in (bx, by, bz) if component > tolerance]

    if len(non_zero) == 3:
        max_component = max(non_zero)
        min_component = min(non_zero)
        if max_component > 0.4 and max_component < 0.6 and (max_component - min_component) / max_component < tolerance:
            return '1/2<111>'

    if sum(component > tolerance for component in (bx, by, bz)) == 1:
        return '<100>'

    sorted_components = sorted([bx, by, bz], reverse=True)
    if abs(sorted_components[0] - sorted_components[1]) < tolerance and sorted_components[2] < tolerance:
        return '<110>'

    max_component = max(bx, by, bz)
    if max_component >= tolerance:
        ratios = [
            abs(bx / max_component - 1),
            abs(by / max_component - 1),
            abs(bz / max_component - 1),
        ]
        if all(ratio < tolerance for ratio in ratios) and max_component >= 0.8:
            return '<111>'

    if sorted_components[0] >= tolerance and sorted_components[1] >= tolerance and sorted_components[2] >= tolerance:
        ratio_one = abs(sorted_components[0] / sorted_components[1] - 2)
        ratio_two = abs(sorted_components[1] / sorted_components[2] - 1)
        if ratio_one < tolerance and ratio_two < tolerance and sorted_components[0] < 0.4:
            return '1/6<112>'

    return 'Other'


def _build_mesh_like_glb(
    *,
    positions: list[float],
    normals: list[float] | None,
    indices: list[int] | None,
    colors: list[float] | None,
    position_bounds: tuple[list[float], list[float]],
    material: Mapping[str, Any],
    mode: int,
    unlit: bool,
) -> bytes:
    if not positions:
        return _build_empty_glb()

    buffer_builder = _BufferBuilder()
    accessors: list[dict[str, Any]] = []
    position_accessor = _add_accessor(
        buffer_builder,
        accessors,
        _pack_floats(positions),
        component_type=5126,
        accessor_type='VEC3',
        count=len(positions) // 3,
        target=34962,
        min_value=position_bounds[0],
        max_value=position_bounds[1],
    )

    normal_accessor = None
    if normals is not None:
        normal_accessor = _add_accessor(
            buffer_builder,
            accessors,
            _pack_floats(normals),
            component_type=5126,
            accessor_type='VEC3',
            count=len(normals) // 3,
            target=34962,
        )

    color_accessor = None
    if colors is not None:
        color_components = 4 if len(colors) == (len(positions) // 3) * 4 else 3
        if len(colors) != (len(positions) // 3) * color_components:
            raise ValueError('Vertex color count does not match vertex count.')
        color_accessor = _add_accessor(
            buffer_builder,
            accessors,
            _pack_floats(colors),
            component_type=5126,
            accessor_type='VEC4' if color_components == 4 else 'VEC3',
            count=len(positions) // 3,
            target=34962,
        )

    index_accessor = None
    if indices is not None:
        component_type, index_bytes = _pack_indices(indices)
        index_accessor = _add_accessor(
            buffer_builder,
            accessors,
            index_bytes,
            component_type=component_type,
            accessor_type='SCALAR',
            count=len(indices),
            target=34963,
        )

    attributes = {'POSITION': position_accessor}
    if normal_accessor is not None:
        attributes['NORMAL'] = normal_accessor
    if color_accessor is not None:
        attributes['COLOR_0'] = color_accessor

    primitive: dict[str, Any] = {
        'attributes': attributes,
        'mode': mode,
        'material': 0,
    }
    if index_accessor is not None:
        primitive['indices'] = index_accessor

    document: dict[str, Any] = {
        'asset': {'version': '2.0'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [primitive]}],
        'materials': [_build_material(material, unlit=unlit)],
        'bufferViews': buffer_builder.buffer_views,
        'accessors': accessors,
        'buffers': [{'byteLength': len(buffer_builder.data)}],
    }
    if unlit:
        document['extensionsUsed'] = ['KHR_materials_unlit']

    return _encode_glb(document, bytes(buffer_builder.data))


def _build_material(material: Mapping[str, Any], *, unlit: bool) -> dict[str, Any]:
    resolved = _normalize_material(material)
    payload: dict[str, Any] = {
        'pbrMetallicRoughness': {
            'baseColorFactor': resolved['baseColor'],
            'metallicFactor': resolved['metallic'],
            'roughnessFactor': resolved['roughness'],
        },
        'emissiveFactor': resolved['emissive'],
        'doubleSided': bool(resolved['doubleSided']),
    }
    if unlit:
        payload['extensions'] = {'KHR_materials_unlit': {}}
    return payload


def _build_empty_glb() -> bytes:
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
    return _encode_glb(document, b'')


def _encode_glb(document: Mapping[str, Any], binary_chunk: bytes) -> bytes:
    json_chunk = json.dumps(document, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
    json_chunk = _pad_chunk(json_chunk, b' ')
    binary_chunk = _pad_chunk(binary_chunk, b'\x00')

    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary_chunk)
    chunks = [
        struct.pack('<III', 0x46546C67, 2, total_length),
        struct.pack('<I4s', len(json_chunk), b'JSON'),
        json_chunk,
        struct.pack('<I4s', len(binary_chunk), b'BIN\x00'),
        binary_chunk,
    ]
    return b''.join(chunks)


def _pad_chunk(data: bytes, pad_byte: bytes) -> bytes:
    padding = (-len(data)) % 4
    if padding == 0:
        return data
    return data + pad_byte * padding


class _BufferBuilder:
    def __init__(self) -> None:
        self.data = bytearray()
        self.buffer_views: list[dict[str, Any]] = []

    def add(self, payload: bytes, *, target: int | None = None) -> int:
        offset = len(self.data)
        self.data.extend(payload)
        while len(self.data) % 4:
            self.data.append(0)

        view: dict[str, Any] = {
            'buffer': 0,
            'byteOffset': offset,
            'byteLength': len(payload),
        }
        if target is not None:
            view['target'] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1


def _add_accessor(
    buffer_builder: _BufferBuilder,
    accessors: list[dict[str, Any]],
    payload: bytes,
    *,
    component_type: int,
    accessor_type: str,
    count: int,
    target: int | None,
    min_value: Sequence[float] | None = None,
    max_value: Sequence[float] | None = None,
) -> int:
    buffer_view = buffer_builder.add(payload, target=target)
    accessor: dict[str, Any] = {
        'bufferView': buffer_view,
        'componentType': component_type,
        'count': count,
        'type': accessor_type,
    }
    if min_value is not None:
        accessor['min'] = [float(value) for value in min_value]
    if max_value is not None:
        accessor['max'] = [float(value) for value in max_value]
    accessors.append(accessor)
    return len(accessors) - 1


def _pack_floats(values: Sequence[float]) -> bytes:
    return struct.pack(f'<{len(values)}f', *[float(value) for value in values])


def _pack_indices(values: Sequence[int]) -> tuple[int, bytes]:
    max_index = max(values, default=0)
    if max_index <= 65535:
        return 5123, struct.pack(f'<{len(values)}H', *[int(value) for value in values])
    return 5125, struct.pack(f'<{len(values)}I', *[int(value) for value in values])


def _compute_normals(positions: Sequence[float], indices: Sequence[int]) -> list[float]:
    normals = [0.0] * len(positions)
    for index in range(0, len(indices), 3):
        ia = indices[index] * 3
        ib = indices[index + 1] * 3
        ic = indices[index + 2] * 3
        ax, ay, az = positions[ia], positions[ia + 1], positions[ia + 2]
        bx, by, bz = positions[ib], positions[ib + 1], positions[ib + 2]
        cx, cy, cz = positions[ic], positions[ic + 1], positions[ic + 2]

        abx, aby, abz = bx - ax, by - ay, bz - az
        acx, acy, acz = cx - ax, cy - ay, cz - az
        nx = aby * acz - abz * acy
        ny = abz * acx - abx * acz
        nz = abx * acy - aby * acx

        normals[ia] += nx
        normals[ia + 1] += ny
        normals[ia + 2] += nz
        normals[ib] += nx
        normals[ib + 1] += ny
        normals[ib + 2] += nz
        normals[ic] += nx
        normals[ic + 1] += ny
        normals[ic + 2] += nz

    for index in range(0, len(normals), 3):
        nx, ny, nz = normals[index], normals[index + 1], normals[index + 2]
        length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        normals[index] = nx / length
        normals[index + 1] = ny / length
        normals[index + 2] = nz / length
    return normals


def _compute_bounds(positions: Sequence[float]) -> tuple[list[float], list[float]]:
    min_bound = [math.inf, math.inf, math.inf]
    max_bound = [-math.inf, -math.inf, -math.inf]
    for index in range(0, len(positions), 3):
        x, y, z = positions[index], positions[index + 1], positions[index + 2]
        min_bound[0] = min(min_bound[0], x)
        min_bound[1] = min(min_bound[1], y)
        min_bound[2] = min(min_bound[2], z)
        max_bound[0] = max(max_bound[0], x)
        max_bound[1] = max(max_bound[1], y)
        max_bound[2] = max(max_bound[2], z)
    return min_bound, max_bound


def _build_vertex_neighbors(vertex_count: int, indices: Sequence[int]) -> list[set[int]]:
    neighbors = [set() for _ in range(vertex_count)]
    for index in range(0, len(indices), 3):
        a, b, c = indices[index], indices[index + 1], indices[index + 2]
        neighbors[a].update((b, c))
        neighbors[b].update((a, c))
        neighbors[c].update((a, b))
    return neighbors


def _laplacian_step(vertices: Sequence[Sequence[float]], neighbors: Sequence[set[int]], weight: float) -> list[list[float]]:
    result: list[list[float]] = []
    for vertex_index, vertex in enumerate(vertices):
        adjacent = neighbors[vertex_index]
        if not adjacent:
            result.append([float(vertex[0]), float(vertex[1]), float(vertex[2])])
            continue
        avg_x = sum(vertices[neighbor][0] for neighbor in adjacent) / len(adjacent)
        avg_y = sum(vertices[neighbor][1] for neighbor in adjacent) / len(adjacent)
        avg_z = sum(vertices[neighbor][2] for neighbor in adjacent) / len(adjacent)
        result.append([
            float(vertex[0]) + weight * (avg_x - float(vertex[0])),
            float(vertex[1]) + weight * (avg_y - float(vertex[1])),
            float(vertex[2]) + weight * (avg_z - float(vertex[2])),
        ])
    return result


def _normalize_material(
    material: Mapping[str, Any] | None,
    *,
    defaults: Mapping[str, Any] | None = None,
    enable_double_sided: bool | None = None,
) -> dict[str, Any]:
    resolved = dict(defaults or _DEFAULT_MESH_MATERIAL)
    if material:
        resolved.update(material)

    if 'base_color' in resolved and 'baseColor' not in resolved:
        resolved['baseColor'] = resolved['base_color']
    if 'double_sided' in resolved and 'doubleSided' not in resolved:
        resolved['doubleSided'] = resolved['double_sided']

    resolved['baseColor'] = _normalize_color_sequence(resolved.get('baseColor'), 4, fallback=[1.0, 1.0, 1.0, 1.0])
    resolved['metallic'] = float(resolved.get('metallic', 0.0))
    resolved['roughness'] = float(resolved.get('roughness', 1.0))
    resolved['emissive'] = _normalize_color_sequence(resolved.get('emissive'), 3, fallback=[0.0, 0.0, 0.0])
    if enable_double_sided is not None:
        resolved['doubleSided'] = bool(enable_double_sided)
    else:
        resolved['doubleSided'] = bool(resolved.get('doubleSided', True))
    return resolved


def _normalize_color_sequence(value: Any, expected_length: int, *, fallback: list[float]) -> list[float]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return fallback
    if len(value) < expected_length:
        return fallback
    result = []
    for index in range(expected_length):
        component = float(value[index])
        if component > 1.0:
            component /= 255.0
        result.append(min(1.0, max(0.0, component)))
    return result


def _flatten_vector_data(values: Sequence[float] | Sequence[Sequence[float]], width: int) -> list[float]:
    if not values:
        return []
    first = values[0]  # type: ignore[index]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        flattened: list[float] = []
        for item in values:  # type: ignore[assignment]
            if not _is_vector(item, width):
                raise ValueError(f'Expected vectors of width {width}.')
            flattened.extend(float(component) for component in item[:width])
        return flattened

    flat = [float(component) for component in values]  # type: ignore[arg-type]
    if len(flat) % width != 0:
        raise ValueError(f'Flat vector data length must be divisible by {width}.')
    return flat


def _flatten_index_data(values: Sequence[int] | Sequence[Sequence[int]]) -> list[int]:
    if not values:
        return []
    first = values[0]  # type: ignore[index]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        flattened: list[int] = []
        for item in values:  # type: ignore[assignment]
            flattened.extend(int(component) for component in item)
        return flattened
    return [int(component) for component in values]  # type: ignore[arg-type]


def _flatten_color_data(values: Sequence[float] | Sequence[Sequence[float]], vertex_count: int) -> list[float]:
    if not values:
        return []
    first = values[0]  # type: ignore[index]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        flattened: list[float] = []
        component_count = len(first)
        if component_count not in {3, 4}:
            raise ValueError('Vertex colors must be RGB or RGBA.')
        for item in values:  # type: ignore[assignment]
            if not _is_vector(item, component_count):
                raise ValueError('Vertex colors must use a consistent component count.')
            flattened.extend(_normalize_color_sequence(item, component_count, fallback=[1.0] * component_count))
        if len(flattened) != vertex_count * component_count:
            raise ValueError('Vertex color count does not match vertex count.')
        return flattened

    flat = [float(component) for component in values]  # type: ignore[arg-type]
    if len(flat) not in {vertex_count * 3, vertex_count * 4}:
        raise ValueError('Vertex color count does not match vertex count.')
    return [
        min(1.0, max(0.0, component / 255.0 if component > 1.0 else component))
        for component in flat
    ]


def _write_output(payload: bytes, output_path: Pathish | None) -> bytes | Path:
    if output_path is None:
        return payload

    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return path


def _is_vector(value: Any, width: int) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes)) and len(value) >= width


def _is_color(value: Any) -> bool:
    return _is_vector(value, 4)


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


def _is_dislocation_export(value: Any) -> bool:
    return isinstance(value, Mapping) and isinstance(value.get('segments'), list)


def _normalize_explicit_color(value: Any) -> list[float] | None:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or len(value) < 3:
        return None
    scale = 255.0 if any(float(component) > 1.0 for component in value[:3]) else 1.0
    return [
        min(1.0, max(0.0, float(value[0]) / scale)),
        min(1.0, max(0.0, float(value[1]) / scale)),
        min(1.0, max(0.0, float(value[2]) / scale)),
    ]


def _color_for_atom(atom: Mapping[str, Any], fallback: list[float]) -> list[float]:
    for key in ('color', 'structure_color', 'rgb', 'base_color'):
        normalized = _normalize_explicit_color(atom.get(key))
        if normalized is not None:
            return normalized
    return fallback


def _color_for_type(type_name: str, type_index: int) -> list[float]:
    predefined = {
        'bcc': [102 / 255, 102 / 255, 1.0],
        'fcc': [102 / 255, 1.0, 102 / 255],
        'hcp': [1.0, 102 / 255, 102 / 255],
        'dislocation': [1.0, 0.2, 0.2],
        'ico': [1.0, 165 / 255, 0.0],
        'sc': [160 / 255, 20 / 255, 254 / 255],
        'cubic_diamond': [19 / 255, 160 / 255, 254 / 255],
        'cubic_diamond_first_neigh': [0.0, 254 / 255, 245 / 255],
        'cubic_diamond_second_neigh': [126 / 255, 254 / 255, 181 / 255],
        'hex_diamond': [254 / 255, 137 / 255, 0.0],
        'hex_diamond_first_neigh': [254 / 255, 220 / 255, 0.0],
        'hex_diamond_second_neigh': [204 / 255, 229 / 255, 81 / 255],
        'graphene': [50 / 255, 205 / 255, 50 / 255],
        'unknown': [128 / 255, 128 / 255, 128 / 255],
        'other': [242 / 255, 242 / 255, 242 / 255],
    }
    normalized = type_name.strip().lower().replace(' ', '_').replace('-', '_')
    if normalized in predefined:
        return predefined[normalized]

    cluster_index = _parse_cluster_index(type_name)
    if cluster_index is not None:
        return _generate_palette_color(cluster_index)
    return _generate_palette_color(type_index)


def _parse_cluster_index(type_name: str) -> int | None:
    parts = type_name.strip().split()
    if len(parts) == 2 and parts[0].lower() == 'cluster' and parts[1].isdigit():
        return int(parts[1])
    return None


def _generate_palette_color(index: int) -> list[float]:
    if index < len(_EXTENDED_PALETTE):
        return list(_EXTENDED_PALETTE[index])
    golden_ratio = 0.618033988749895
    hue = ((index - len(_EXTENDED_PALETTE)) * golden_ratio) % 1.0
    saturation = 0.65 + (index % 3) * 0.1
    lightness = 0.45 + (index % 2) * 0.12
    return _hsl_to_rgb(hue, saturation, lightness)


def _hsl_to_rgb(hue: float, saturation: float, lightness: float) -> list[float]:
    if saturation == 0:
        return [lightness, lightness, lightness]

    def hue_to_rgb(p: float, q: float, value: float) -> float:
        if value < 0:
            value += 1
        if value > 1:
            value -= 1
        if value < 1 / 6:
            return p + (q - p) * 6 * value
        if value < 1 / 2:
            return q
        if value < 2 / 3:
            return p + (q - p) * (2 / 3 - value) * 6
        return p

    q = lightness * (1 + saturation) if lightness < 0.5 else lightness + saturation - lightness * saturation
    p = 2 * lightness - q
    return [
        hue_to_rgb(p, q, hue + 1 / 3),
        hue_to_rgb(p, q, hue),
        hue_to_rgb(p, q, hue - 1 / 3),
    ]


def _cross(left: Sequence[float], right: Sequence[float]) -> list[float]:
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]
