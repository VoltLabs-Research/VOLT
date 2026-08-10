from __future__ import annotations

import colorsys
from collections.abc import Iterable, Mapping, Sequence

from .helpers import _is_color

_DEFAULT_MESH_MATERIAL = {
    'baseColor': [0.8, 0.8, 0.85, 1.0],
    'metallic': 0.05,
    'roughness': 0.9,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_DEFAULT_LINE_MATERIAL = {
    'baseColor': [1.0, 0.5, 0.0, 1.0],
    'metallic': 0.0,
    'roughness': 0.8,
    'emissive': [0.0, 0.0, 0.0],
    'doubleSided': True,
}

_GOLDEN_RATIO_CONJUGATE = 0.618033988749895

_STRUCTURE_COLORS = {
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

def _color_for_type(type_name: str) -> list[float]:
    return _STRUCTURE_COLORS.get(type_name.lower(), _STRUCTURE_COLORS['other'])

def _resolve_category_colors(
    values: Iterable[str],
    explicit_colors: Mapping[str, Sequence[float]] | None = None,
) -> dict[str, list[float]]:
    """Resolve a deterministic RGBA color per category value.

    Mirrors the daemon's ``category-colors.ts``: unique values are sorted
    alphabetically; values with an explicit color keep it; the remaining values
    get a golden-ratio HSL fallback (s=0.65, l=0.55, alpha 1) where the fallback
    index counts only the values without explicit colors, in sorted order.
    """
    explicit: dict[str, list[float]] = {}
    if explicit_colors:
        for key, value in explicit_colors.items():
            if _is_color(value):
                explicit[str(key)] = [float(component) for component in value[:4]]

    resolved: dict[str, list[float]] = {}
    fallback_index = 0
    for value in sorted(set(values)):
        color = explicit.get(value)
        if color is None:
            hue = (fallback_index * _GOLDEN_RATIO_CONJUGATE) % 1.0
            red, green, blue = colorsys.hls_to_rgb(hue, 0.55, 0.65)
            color = [red, green, blue, 1.0]
            fallback_index += 1
        resolved[value] = color
    return resolved
