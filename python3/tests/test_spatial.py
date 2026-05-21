from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.plugin import PluginRun
from voltsdk.spatial import SpatialAssembler


def _sample_dislocation_payload() -> dict:
    return {
        'export': {
            'DislocationExporter': {
                'segments': [
                    {
                        'points': [
                            [0.0, 0.0, 0.0],
                            [1.0, 0.0, 0.0],
                            [1.0, 1.0, 0.0],
                        ],
                        'burgers': {
                            'vector': [0.5, 0.5, 0.5],
                        },
                    },
                ],
            },
        },
    }


class SpatialAssemblerTests(unittest.TestCase):
    def test_glb_infers_dislocation_export_from_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload_path = root / 'dislocations.json'
            output_path = root / 'dislocations.glb'
            payload_path.write_text(json.dumps(_sample_dislocation_payload()), encoding='utf-8')

            result = SpatialAssembler().glb(payload_path, output_path=output_path)

            self.assertEqual(result, output_path)
            self.assertTrue(output_path.is_file())
            self.assertEqual(output_path.read_bytes()[:4], b'glTF')

    def test_plugin_run_glb_writes_sibling_glb(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload_path = root / 'output_dislocations.json'
            payload_path.write_text(json.dumps(_sample_dislocation_payload()), encoding='utf-8')

            run = PluginRun(
                command=[],
                returncode=0,
                stdout='',
                stderr='',
                output_base=root / 'output',
                artifacts={
                    'dislocations': payload_path,
                    'dislocations.json': payload_path,
                },
            )

            result = run.glb('dislocations')

            self.assertEqual(result, root / 'output_dislocations.glb')
            self.assertTrue(result.is_file())
            self.assertEqual(result.read_bytes()[:4], b'glTF')


if __name__ == '__main__':
    unittest.main()
