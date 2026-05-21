from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.plugin import Plugin, PluginRun


def _write_plugin(root: Path, name: str) -> None:
    bin_dir = root / 'bin'
    bin_dir.mkdir(parents=True, exist_ok=True)
    executable = bin_dir / name
    executable.write_text(
        '#!/usr/bin/env python3\n'
        'from pathlib import Path\n'
        'import json\n'
        'import sys\n'
        'input_path = Path(sys.argv[1])\n'
        'output_prefix = Path(sys.argv[2])\n'
        'output_prefix.parent.mkdir(parents=True, exist_ok=True)\n'
        '(output_prefix.parent / f"{output_prefix.name}_copy.txt").write_text(input_path.read_text(), encoding="utf-8")\n'
        '(output_prefix.parent / f"{output_prefix.name}_summary.json").write_text(json.dumps({"source": str(input_path), "rows": [{"x": 1}]}), encoding="utf-8")\n',
        encoding='utf-8',
    )
    executable.chmod(0o755)


class PluginApiTests(unittest.TestCase):
    def test_run_uses_output_dir_and_returns_rich_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plugin_root = root / 'plugin'
            _write_plugin(plugin_root, 'demo-plugin')
            input_path = root / 'input.txt'
            input_path.write_text('hello', encoding='utf-8')

            run = Plugin('voltlabs@demo-plugin', '1.0.0', plugin_root)(
                input_path,
                output_dir=root / 'out',
            )

            self.assertEqual(run.output_dir, root / 'out')
            self.assertEqual(run.output_prefix, root / 'out' / 'demo-plugin')
            self.assertEqual(run['copy.txt'].path.read_text(encoding='utf-8'), 'hello')
            self.assertEqual(run['summary'].json('source'), str(input_path.resolve()))
            self.assertEqual(run['summary'].df('rows').iloc[0].to_dict(), {'x': 1})

    def test_artifact_can_be_used_as_plugin_input_and_option(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run = PluginRun(
                command=[],
                returncode=0,
                stdout='',
                stderr='',
                output_prefix=root / 'source',
                output_dir=root,
                artifacts={'input.txt': root / 'source_input.txt'},
            )
            run['input.txt'].path.write_text('artifact input', encoding='utf-8')

            plugin_root = root / 'plugin'
            _write_plugin(plugin_root, 'consumer')

            result = Plugin('voltlabs@consumer', '1.0.0', plugin_root)(
                run['input.txt'],
                output_dir=root / 'out',
                related=run['input.txt'],
            )

            self.assertIn(str(run['input.txt'].path), result.command)
            self.assertIn(str(run['input.txt'].path), result.command)
            self.assertEqual(result['copy.txt'].path.read_text(encoding='utf-8'), 'artifact input')


if __name__ == '__main__':
    unittest.main()
