from __future__ import annotations

import os
from typing import Any

import msgpack
import pandas as pd

def get_nested_value(data: Any, path: str | None) -> Any:
    if not path:
        return data

    current = data
    for key in path.split('.'):
        if not isinstance(current, dict):
            return None
        if key not in current:
            return None
        current = current[key]
    return current

def merged_chunked_value(target: Any, incoming: Any) -> Any:
    if incoming is None:
        return target
    if target is None:
        return incoming

    if isinstance(target, list) and isinstance(incoming, list):
        target.extend(incoming)
        return target

    if isinstance(target, dict) and isinstance(incoming, dict):
        for key, incoming_value in incoming.items():
            target_value = target.get(key)
            if isinstance(target_value, list) and isinstance(incoming_value, list):
                target_value.extend(incoming_value)
            elif isinstance(target_value, dict) and isinstance(incoming_value, dict):
                target[key] = merged_chunked_value(target_value, incoming_value)
            else:
                target[key] = incoming_value
        return target

    return incoming

def is_columnar_dict(value: Any) -> bool:
    if not isinstance(value, dict) or not value:
        return False
    lengths: list[int] = []
    for item in value.values():
        if not isinstance(item, list):
            return False
        lengths.append(len(item))
    return len(set(lengths)) == 1

def msgpack_as_df(
    file_path: str,
    iterable_key: str | None = None,
) -> pd.DataFrame:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f'File not found: {file_path}')

    data: Any = None
    with open(file_path, 'rb') as fh:
        unpacker = msgpack.Unpacker(fh, raw=False)
        for message in unpacker:
            chunk = get_nested_value(message, iterable_key)
            data = merged_chunked_value(data, chunk)

    return frame_from_data(data)

def frame_from_data(data: Any) -> pd.DataFrame:
    if data is None:
        return pd.DataFrame()
    if isinstance(data, list) or is_columnar_dict(data):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        return pd.DataFrame([data])
    return pd.DataFrame([{'value': data}])
