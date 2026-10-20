from __future__ import annotations

import struct
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd

_DTYPE_F32 = 0
_DTYPE_U32 = 1
_DTYPE_U16 = 2
_DTYPE_STR = 3

_NUMERIC_DTYPES = {
    _DTYPE_F32: ('<f4', 4),
    _DTYPE_U32: ('<u4', 4),
    _DTYPE_U16: ('<u2', 2),
}


def atoms_columnar_meta(payload: bytes) -> dict:
    """Decode only the pagination header of an atoms binary payload."""
    total, page, limit, total_pages, count, _props = struct.unpack_from('<6I', payload, 0)
    return {
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': total_pages,
        'count': count,
    }


def atoms_columnar_as_df(payload: bytes) -> 'pd.DataFrame':
    """Decode VOLT's little-endian columnar atom wire format into a DataFrame.

    Layout (see the server's ``encode-atoms-binary``):
      [u32 total][u32 page][u32 limit][u32 totalPages][u32 count][u32 propsCount]
      per prop: [u8 nameLen][name][u8 dtypeId][u32 byteLen]
      [u32 padLen][padLen zero bytes]
      [contiguous data blocks in prop order]   # str blocks are length-prefixed rows
    """
    import numpy as np
    import pandas as pd

    offset = 0
    _total, _page, _limit, _total_pages, count, props_count = struct.unpack_from('<6I', payload, offset)
    offset += 24

    columns: list[tuple[str, int, int]] = []
    for _ in range(props_count):
        name_len = payload[offset]
        offset += 1
        name = payload[offset:offset + name_len].decode('utf-8')
        offset += name_len
        dtype_id = payload[offset]
        offset += 1
        (byte_len,) = struct.unpack_from('<I', payload, offset)
        offset += 4
        columns.append((name, dtype_id, byte_len))

    (pad_len,) = struct.unpack_from('<I', payload, offset)
    offset += 4 + pad_len

    frame: dict[str, object] = {}
    for name, dtype_id, byte_len in columns:
        block = payload[offset:offset + byte_len]
        offset += byte_len
        if dtype_id in _NUMERIC_DTYPES:
            np_dtype, _size = _NUMERIC_DTYPES[dtype_id]
            frame[name] = np.frombuffer(block, dtype=np_dtype, count=count)
        elif dtype_id == _DTYPE_STR:
            frame[name] = _decode_string_block(block, count)
        else:
            raise ValueError(f'Unsupported atom column dtype id: {dtype_id}')

    return pd.DataFrame(frame)


def _decode_string_block(block: bytes, count: int) -> list[str]:
    values: list[str] = []
    offset = 0
    for _ in range(count):
        (length,) = struct.unpack_from('<I', block, offset)
        offset += 4
        values.append(block[offset:offset + length].decode('utf-8'))
        offset += length
    return values
