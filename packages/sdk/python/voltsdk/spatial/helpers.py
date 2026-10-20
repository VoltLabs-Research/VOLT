from __future__ import annotations

from collections.abc import Sequence
from typing import Any

def _is_vector(value: Any, width: int) -> bool:
    return isinstance(value, Sequence) and not isinstance(value, (str, bytes)) and len(value) >= width

def _is_color(value: Any) -> bool:
    return _is_vector(value, 4)

def _flatten_vector_data(values: Sequence[float] | Sequence[Sequence[float]], width: int) -> list[float]:
    if not values:
        return []
    first = values[0]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        flattened: list[float] = []
        for item in values:
            if not _is_vector(item, width):
                raise ValueError(f'Expected vectors of width {width}.')
            flattened.extend(float(component) for component in item[:width])
        return flattened

    flat = [float(component) for component in values]
    if len(flat) % width != 0:
        raise ValueError(f'Flat vector data length must be divisible by {width}.')
    return flat

def _flatten_index_data(values: Sequence[int] | Sequence[Sequence[int]]) -> list[int]:
    if not values:
        return []
    first = values[0]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        flattened: list[int] = []
        for item in values:
            flattened.extend(int(component) for component in item)
        return flattened
    return [int(component) for component in values]

def _flatten_color_data(values: Sequence[float] | Sequence[Sequence[float]]) -> list[float]:
    if not values:
        return []
    first = values[0]
    if isinstance(first, Sequence) and not isinstance(first, (str, bytes)):
        return [float(component) for item in values for component in item]
    return [float(component) for component in values]
