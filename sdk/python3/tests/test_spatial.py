from __future__ import annotations

import json
import struct
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.plugin import PluginRun
from voltsdk.spatial import SpatialAssembler


def _sample_line_payload() -> dict:
    return {
        'export': {
            'LineExporter': {
                'lines': [
                    {
                        'id': 0,
                        'points': [
                            [0.0, 0.0, 0.0],
                            [1.0, 0.0, 0.0],
                            [1.0, 1.0, 0.0],
                        ],
                        'burgers_family': '1/2<111>',
                        'burgers_family_label': '1/2<111>',
                        'crystal_structure': 'bcc',
                        'length': 2.0,
                        'magnitude': 0.8660254037844386,
                        'num_points': 3,
                        'burgers_vector_local': [0.5, 0.5, 0.5],
                        'burgers_vector_global': [0.5, 0.5, 0.5],
                        'cluster_id': 1,
                    },
                ],
            },
        },
    }


def _glb_json(path: Path) -> dict:
    data = path.read_bytes()
    chunk_length = struct.unpack_from('<I', data, 12)[0]
    chunk_type = data[16:20]
    if chunk_type != b'JSON':
        raise AssertionError(f'Unexpected first GLB chunk type: {chunk_type!r}')
    return json.loads(data[20:20 + chunk_length].rstrip(b' \0').decode('utf-8'))


class SpatialAssemblerTests(unittest.TestCase):
    def test_glb_infers_line_export_from_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload_path = root / 'dislocations.json'
            output_path = root / 'dislocations.glb'
            payload_path.write_text(json.dumps(_sample_line_payload()), encoding='utf-8')

            result = SpatialAssembler().glb(payload_path, output_path=output_path)

            self.assertEqual(result, output_path)
            self.assertTrue(output_path.is_file())
            self.assertEqual(output_path.read_bytes()[:4], b'glTF')

            document = _glb_json(output_path)
            material = document['materials'][0]['pbrMetallicRoughness']
            self.assertEqual(material['baseColorFactor'], [1.0, 0.5, 0.0, 1.0])
            self.assertEqual(material['metallicFactor'], 0.0)
            self.assertEqual(material['roughnessFactor'], 0.8)
            position_accessor = document['accessors'][0]
            self.assertAlmostEqual(position_accessor['min'][2], -0.4)
            self.assertAlmostEqual(position_accessor['max'][2], 0.4)

    def test_plugin_run_glb_writes_sibling_glb(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload_path = root / 'output_dislocations.json'
            payload_path.write_text(json.dumps(_sample_line_payload()), encoding='utf-8')

            run = PluginRun(
                command=[],
                returncode=0,
                stdout='',
                stderr='',
                output_prefix=root / 'output',
                output_dir=root,
                artifacts={
                    'dislocations': payload_path,
                    'dislocations.json': payload_path,
                },
            )

            result = run['dislocations'].glb()

            self.assertEqual(result, root / 'output_dislocations.glb')
            self.assertTrue(result.is_file())
            self.assertEqual(result.read_bytes()[:4], b'glTF')


if __name__ == '__main__':
    unittest.main()
