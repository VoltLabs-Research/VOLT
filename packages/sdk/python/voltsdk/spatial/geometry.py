from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

from .colors import _color_for_type, _resolve_category_colors
from .helpers import _is_vector

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

    for type_name, atoms in export_data.items():
        if not isinstance(atoms, list):
            continue
        color = _color_for_type(str(type_name))
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

def _process_lines(
    export_data: Mapping[str, Any],
    *,
    line_width: float,
    tubular_segments: int,
    min_line_points: int,
    color_by: str | None,
    property_colors: Mapping[str, Sequence[float]] | None,
) -> dict[str, Any] | None:
    lines = export_data.get('lines')
    if not isinstance(lines, list):
        return None

    colors: list[list[float]] | None = None
    category_colors: dict[str, list[float]] = {}
    if color_by:
        colors = []
        categories = [_line_category(line, color_by) for line in lines if isinstance(line, Mapping)]
        category_colors = _resolve_category_colors(categories, property_colors)

    positions: list[float] = []
    normals: list[float] = []
    indices: list[int] = []
    min_bound = [math.inf, math.inf, math.inf]
    max_bound = [-math.inf, -math.inf, -math.inf]

    for line in lines:
        if not isinstance(line, Mapping):
            continue
        points = line.get('points')
        if not isinstance(points, list) or len(points) < min_line_points:
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

        if colors is not None and color_by:
            color = category_colors[_line_category(line, color_by)]
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

def _line_category(line: Mapping[str, Any], property_name: str) -> str:
    value = line.get(property_name)
    return '' if value is None else str(value)

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

def _cross(left: Sequence[float], right: Sequence[float]) -> list[float]:
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]
