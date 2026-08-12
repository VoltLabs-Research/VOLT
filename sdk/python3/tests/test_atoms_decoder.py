from __future__ import annotations

import struct
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _encode_atoms(total, page, limit, total_pages, count, columns):
    """Mirror of the server's encode-atoms-binary wire format (for tests)."""
    header = struct.pack('<6I', total, page, limit, total_pages, count, len(columns))
    for name, dtype_id, raw in columns:
        name_bytes = name.encode('utf-8')
        header += struct.pack('<B', len(name_bytes)) + name_bytes
        header += struct.pack('<B', dtype_id) + struct.pack('<I', len(raw))
    hdr_with_pad_field = len(header) + 4
    pad = (4 - (hdr_with_pad_field % 4)) % 4
    header += struct.pack('<I', pad) + (b'\x00' * pad)
    return header + b''.join(raw for _, _, raw in columns)


def _str_block(values):
    out = b''
    for value in values:
        encoded = value.encode('utf-8')
        out += struct.pack('<I', len(encoded)) + encoded
    return out


class AtomsDecoderTests(unittest.TestCase):
    def setUp(self) -> None:
        try:
            import numpy as np
            import pandas as pd
        except ImportError:
            self.skipTest('numpy/pandas not installed')

    def _payload(self, page: int, total_pages: int):
        import numpy as np

        ids = np.array([10, 11, 12], dtype='<u4').tobytes()
        types = np.array([1, 2, 1], dtype='<u4').tobytes()
        xs = np.array([0.5, 1.5, 2.5], dtype='<f4').tobytes()
        names = _str_block(['FCC', 'HCP', 'FCC'])
        return _encode_atoms(9, page, 3, total_pages, 3, [
            ('id', 1, ids),
            ('type', 1, types),
            ('x', 0, xs),
            ('StructureName', 3, names),
        ])

    def test_meta_reads_pagination_header(self) -> None:
        from voltsdk.io.atoms import atoms_columnar_meta

        meta = atoms_columnar_meta(self._payload(page=1, total_pages=3))
        self.assertEqual(meta['total'], 9)
        self.assertEqual(meta['total_pages'], 3)
        self.assertEqual(meta['count'], 3)

    def test_decodes_numeric_and_string_columns(self) -> None:
        from voltsdk.io.atoms import atoms_columnar_as_df

        df = atoms_columnar_as_df(self._payload(page=1, total_pages=1))
        self.assertEqual(list(df['id']), [10, 11, 12])
        self.assertEqual(list(df['type']), [1, 2, 1])
        self.assertAlmostEqual(float(df['x'][1]), 1.5, places=5)
        self.assertEqual(list(df['StructureName']), ['FCC', 'HCP', 'FCC'])


if __name__ == '__main__':
    unittest.main()
