from __future__ import annotations

import hashlib
import json
import tarfile
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import sys
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.hub import PluginHub
from voltsdk.plugins.registry import (
    BundleRef,
    PluginRegistry,
    _looks_like_range,
    _pick_semver_range,
    _resolve_key,
)


def _write_bundle(path: Path) -> bytes:
    with tempfile.TemporaryDirectory() as bundle_tmp:
        root = Path(bundle_tmp)
        bin_dir = root / 'bin'
        bin_dir.mkdir(parents=True, exist_ok=True)
        executable = bin_dir / 'demo-plugin'
        executable.write_text('#!/bin/sh\nexit 0\n', encoding='utf-8')
        with tarfile.open(path, 'w:gz') as archive:
            archive.add(bin_dir, arcname='bin')
    return path.read_bytes()


class _RegistryServer:
    def __init__(self, packages: dict, bundles: dict[str, bytes]):
        self.packages = packages
        self.bundles = bundles
        registry = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                return

            def do_GET(self):
                parsed = urlparse(self.path)
                segments = [s for s in parsed.path.split('/') if s]
                if segments[:1] == ['-'] and segments[1:2] == ['search']:
                    query = parse_qs(parsed.query)
                    page = int(query.get('page', ['1'])[0])
                    items = []
                    for full_name in sorted(registry.packages.keys()):
                        items.append({'fullName': full_name})
                    body = json.dumps({'items': items if page == 1 else [], 'page': page, 'total': len(items)}).encode()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                if segments[:1] == ['packages'] and len(segments) >= 3:
                    scope = segments[1]
                    name = segments[2]
                    full_name = f'@{scope}/{name}'
                    if len(segments) == 3:
                        packument = registry.packages.get(full_name)
                        if packument is None:
                            self.send_response(404)
                            self.end_headers()
                            return
                        body = json.dumps(packument).encode()
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Content-Length', str(len(body)))
                        self.end_headers()
                        self.wfile.write(body)
                        return
                    if len(segments) == 6 and segments[4] == '-':
                        version = segments[3]
                        platform = segments[5].rsplit('.', 1)[0]
                        key = f'{full_name}@{version}/{platform}'
                        bundle = registry.bundles.get(key)
                        if bundle is None:
                            self.send_response(404)
                            self.end_headers()
                            return
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/octet-stream')
                        self.send_header('Content-Length', str(len(bundle)))
                        self.end_headers()
                        self.wfile.write(bundle)
                        return
                self.send_response(404)
                self.end_headers()

        self._server = HTTPServer(('127.0.0.1', 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    @property
    def url(self) -> str:
        host, port = self._server.server_address
        return f'http://{host}:{port}'

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join(timeout=2)


class KeyResolutionTests(unittest.TestCase):
    def test_legacy_form(self) -> None:
        self.assertEqual(_resolve_key('voltlabs@opendxa'), ('voltlabs', 'opendxa'))

    def test_canonical_form(self) -> None:
        self.assertEqual(_resolve_key('@voltlabs/opendxa'), ('voltlabs', 'opendxa'))

    def test_slash_form_without_at(self) -> None:
        self.assertEqual(_resolve_key('voltlabs/opendxa'), ('voltlabs', 'opendxa'))

    def test_rejects_empty(self) -> None:
        with self.assertRaises(ValueError):
            _resolve_key('')

    def test_rejects_double_at(self) -> None:
        with self.assertRaises(ValueError):
            _resolve_key('voltlabs@open@dxa')


class SemverResolutionTests(unittest.TestCase):
    def test_caret(self) -> None:
        picked = _pick_semver_range(['1.0.0', '1.2.3', '2.0.0'], '^1.0.0')
        self.assertEqual(picked, '1.2.3')

    def test_tilde(self) -> None:
        picked = _pick_semver_range(['1.2.0', '1.2.9', '1.3.0'], '~1.2.0')
        self.assertEqual(picked, '1.2.9')

    def test_explicit_gte(self) -> None:
        picked = _pick_semver_range(['1.0.0', '1.5.0', '2.0.0'], '>=1.2.0 <2.0.0')
        self.assertEqual(picked, '1.5.0')

    def test_no_match_returns_none(self) -> None:
        picked = _pick_semver_range(['1.0.0'], '^2.0.0')
        self.assertIsNone(picked)

    def test_looks_like_range(self) -> None:
        self.assertTrue(_looks_like_range('^1.0.0'))
        self.assertTrue(_looks_like_range('>=1.0 <2'))
        self.assertFalse(_looks_like_range('1.0.0'))
        self.assertFalse(_looks_like_range('latest'))


class RegistryHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        bundle_path = root / 'demo.tgz'
        bundle_bytes = _write_bundle(bundle_path)
        sha = hashlib.sha256(bundle_bytes).hexdigest()
        self.packument = {
            'fullName': '@voltlabs/demo-plugin',
            'scope': 'voltlabs',
            'name': 'demo-plugin',
            'kind': 'engine',
            'distTags': {'latest': '1.2.0'},
            'versions': {
                '1.0.0': {
                    'version': '1.0.0',
                    'platforms': [
                        {'tag': 'linux-x86_64', 'sha256': sha, 'sizeBytes': len(bundle_bytes), 'key': 'a'},
                    ],
                },
                '1.2.0': {
                    'version': '1.2.0',
                    'platforms': [
                        {'tag': 'linux-x86_64', 'sha256': sha, 'sizeBytes': len(bundle_bytes), 'key': 'b'},
                    ],
                },
            },
            'downloads': {'total': 0, 'last30d': 0},
        }
        self.server = _RegistryServer(
            packages={'@voltlabs/demo-plugin': self.packument},
            bundles={
                '@voltlabs/demo-plugin@1.0.0/linux-x86_64': bundle_bytes,
                '@voltlabs/demo-plugin@1.2.0/linux-x86_64': bundle_bytes,
            },
        )
        self.addCleanup(self.server.close)

    def _registry(self) -> PluginRegistry:
        return PluginRegistry(
            url=self.server.url,
            cache_dir=Path(self.tmp.name) / 'cache',
            platform_tag='linux-x86_64',
        )

    def test_resolve_latest(self) -> None:
        ref = self._registry().resolve('voltlabs@demo-plugin')
        self.assertIsInstance(ref, BundleRef)
        self.assertEqual(ref.version, '1.2.0')
        self.assertTrue(ref.url.endswith('/packages/voltlabs/demo-plugin/1.2.0/-/linux-x86_64.tgz'))

    def test_resolve_range(self) -> None:
        ref = self._registry().resolve('@voltlabs/demo-plugin', '^1.0.0')
        self.assertEqual(ref.version, '1.2.0')

    def test_install_verifies_sha256(self) -> None:
        registry = self._registry()
        path = registry.install('voltlabs@demo-plugin')
        self.assertTrue(path.is_dir())
        self.assertTrue((path / 'bin' / 'demo-plugin').is_file())

    def test_versions_sorted(self) -> None:
        versions = self._registry().versions('@voltlabs/demo-plugin')
        self.assertEqual(versions, ['1.0.0', '1.2.0'])

    def test_hub_default_publisher(self) -> None:
        hub = PluginHub(
            url=self.server.url,
            cache_dir=Path(self.tmp.name) / 'cache-hub',
            default_publisher='voltlabs',
        )
        plugin = hub.get('demo-plugin')
        self.assertEqual(plugin.key, 'voltlabs@demo-plugin')
        self.assertTrue(plugin.root.is_dir())


if __name__ == '__main__':
    unittest.main()
