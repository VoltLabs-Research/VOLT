from __future__ import annotations

import json
import tarfile
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.hub import PluginHub
from voltsdk.plugins.registry import PluginRegistry


def _write_bundle(path: Path) -> None:
    with tempfile.TemporaryDirectory() as bundle_tmp:
        root = Path(bundle_tmp)
        bin_dir = root / 'bin'
        bin_dir.mkdir(parents=True, exist_ok=True)
        executable = bin_dir / 'demo-plugin'
        executable.write_text('#!/bin/sh\nexit 0\n', encoding='utf-8')
        with tarfile.open(path, 'w:gz') as archive:
            archive.add(bin_dir, arcname='bin')


class PluginRegistryTests(unittest.TestCase):
    def test_install_ignores_sha256_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle_path = root / 'demo-plugin-1.0.0-linux-x86_64.tgz'
            _write_bundle(bundle_path)

            index = {
                'plugins': {
                    'voltlabs': {
                        'demo-plugin': {
                            'publisher': 'voltlabs',
                            'latest': '1.0.0',
                            'versions': {
                                '1.0.0': {
                                    'linux-x86_64': {
                                        'url': bundle_path.name,
                                        'sha256': 'definitely-wrong',
                                    },
                                },
                            },
                        },
                    },
                },
            }
            index_path = root / 'index.json'
            index_path.write_text(json.dumps(index), encoding='utf-8')

            registry = PluginRegistry(
                url=index_path.as_uri(),
                cache_dir=root / 'cache',
                platform_tag='linux-x86_64',
            )

            installed = registry.install('voltlabs@demo-plugin')

            self.assertTrue(installed.is_dir())
            self.assertTrue((installed / 'bin' / 'demo-plugin').is_file())

    def test_hub_default_publisher_resolves_short_plugin_keys(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bundle_path = root / 'demo-plugin-1.0.0-linux-x86_64.tgz'
            _write_bundle(bundle_path)

            index = {
                'plugins': {
                    'voltlabs': {
                        'demo-plugin': {
                            'publisher': 'voltlabs',
                            'latest': '1.0.0',
                            'versions': {
                                '1.0.0': {
                                    'linux-x86_64': {
                                        'url': bundle_path.name,
                                    },
                                },
                            },
                        },
                    },
                },
            }
            index_path = root / 'index.json'
            index_path.write_text(json.dumps(index), encoding='utf-8')

            hub = PluginHub(
                url=index_path.as_uri(),
                cache_dir=root / 'cache',
                default_publisher='voltlabs',
            )

            plugin = hub.get('demo-plugin')

            self.assertEqual(plugin.key, 'voltlabs@demo-plugin')
            self.assertTrue(plugin.root.is_dir())


if __name__ == '__main__':
    unittest.main()
