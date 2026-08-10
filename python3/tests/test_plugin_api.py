from __future__ import annotations

import json
import sys
import tempfile
import unittest
from enum import Enum
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.plugins.errors import PluginError
from voltsdk.plugins.interface import params_checksum
from voltsdk.plugins.plugin import Plugin, PluginRun

STRUCTURE_ID = 'volt/structure-identification@1'
PER_ATOM = 'volt/per-atom-properties@1'

PRODUCER_SOURCE = '''#!/usr/bin/env python3
import sys
from pathlib import Path

args = sys.argv[1:]
prefix = Path(args[1])
prefix.parent.mkdir(parents=True, exist_ok=True)
(prefix.parent / f'{prefix.name}_argv.txt').write_text(' '.join(args), encoding='utf-8')
for name in %(artifacts)r:
    (prefix.parent / f'{prefix.name}_{name}').write_text('data', encoding='utf-8')
'''

CONSUMER_SOURCE = '''#!/usr/bin/env python3
import sys
from pathlib import Path

args = sys.argv[1:]
prefix = Path(args[1])
prefix.parent.mkdir(parents=True, exist_ok=True)
(prefix.parent / f'{prefix.name}_argv.txt').write_text(' '.join(args), encoding='utf-8')
(prefix.parent / f'{prefix.name}_dislocations.parquet').write_text('lines', encoding='utf-8')
'''

def _params(options: list[dict]) -> dict:
    return {
        'descriptor': 1,
        'generated': True,
        'checksum': params_checksum(options),
        'options': options,
    }

def _write_plugin(root: Path, name: str, source: str, interface: dict) -> Path:
    bin_dir = root / 'bin'
    bin_dir.mkdir(parents=True, exist_ok=True)
    executable = bin_dir / name
    executable.write_text(source, encoding='utf-8')
    executable.chmod(0o755)
    (root / 'plugin.json').write_text(json.dumps({'interface': interface}), encoding='utf-8')
    return root

def _producer(root: Path, *, artifacts: tuple[str, ...] = (
    'annotated.dump', 'clusters.table', 'cluster_transitions.table', 'neighbor_lattice.parquet',
    'atoms.parquet',
)) -> Plugin:
    _write_plugin(
        root,
        'producer',
        PRODUCER_SOURCE % {'artifacts': list(artifacts)},
        {
            'version': 2,
            'provides': {
                STRUCTURE_ID: {
                    'annotated_dump': 'annotated.dump',
                    'clusters_table': 'clusters.table',
                    'cluster_transitions': 'cluster_transitions.table',
                    'neighbor_lattice': 'neighbor_lattice.parquet',
                },
                PER_ATOM: {'atoms': 'atoms.parquet'},
            },
            'params': _params([
                {'flag': '--crystal_structure', 'type': 'enum', 'default': 'FCC',
                 'values': ['SC', 'FCC', 'HCP', 'BCC']},
                {'flag': '--rmsd', 'type': 'float', 'default': '0.1'},
                {'flag': '--dissolve_small_clusters', 'type': 'bool', 'default': 'false'},
            ]),
        },
    )
    return Plugin('@voltlabs/producer', '1.0.0', root)

def _consumer(root: Path, **overrides) -> Plugin:
    interface = {
        'version': 2,
        'requires': [{
            'id': 'structure',
            'capability': STRUCTURE_ID,
            'bind': {
                'clusters_table': '--clusters_table',
                'cluster_transitions': '--clusters_transitions',
                'neighbor_lattice': '--neighbor_lattice',
            },
        }],
        'input': {'from': 'structure', 'port': 'annotated_dump'},
        'provides': {'volt/dislocation-network@1': {'dislocations': 'dislocations.parquet'}},
        'params': _params([
            {'flag': '--clusters_table', 'type': 'path'},
            {'flag': '--clusters_transitions', 'type': 'path'},
            {'flag': '--neighbor_lattice', 'type': 'path'},
            {'flag': '--reference_topology', 'type': 'enum', 'default': 'fcc',
             'values': ['fcc', 'bcc', 'hcp', 'sc']},
            {'flag': '--line_smoothing_level', 'type': 'int', 'default': '1'},
            {'flag': '--lattice_dir', 'type': 'path', 'bundleDefault': 'share/volt/lattices'},
        ]),
    }
    interface.update(overrides)
    _write_plugin(root, 'consumer', CONSUMER_SOURCE, interface)
    lattices = root / 'share' / 'volt' / 'lattices'
    lattices.mkdir(parents=True, exist_ok=True)
    (lattices / 'fcc.yml').write_text('name: fcc\n', encoding='utf-8')
    return Plugin('@voltlabs/consumer', '1.0.0', root)

class Lattice(Enum):
    FCC = 'fcc'
    BCC = 'bcc'

class CapabilityWiringTests(unittest.TestCase):
    def test_upstream_run_wires_every_port_of_the_capability(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')

            producer = _producer(root / 'ptm')
            consumer = _consumer(root / 'dxa')

            upstream = producer(dump, output_dir=root / 'out', crystal_structure=Lattice.FCC)
            self.assertIn(STRUCTURE_ID, upstream.provides)

            run = consumer(upstream, output_dir=root / 'out', reference_topology=Lattice.FCC)

            argv = run['argv.txt'].path.read_text(encoding='utf-8')
            self.assertEqual(run.command[1], str(upstream.provides[STRUCTURE_ID]['annotated_dump']))
            for flag, port in (
                ('--clusters_table', 'clusters_table'),
                ('--clusters_transitions', 'cluster_transitions'),
                ('--neighbor_lattice', 'neighbor_lattice'),
            ):
                self.assertIn(f'{flag} {upstream.provides[STRUCTURE_ID][port]}', argv)
            self.assertIn('--reference_topology fcc', argv)

    def test_bundle_default_is_resolved_against_the_installed_plugin(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')
            consumer = _consumer(root / 'dxa')

            upstream = producer(dump, output_dir=root / 'out')
            run = consumer(upstream, output_dir=root / 'out')

            argv = run['argv.txt'].path.read_text(encoding='utf-8')
            self.assertIn(f'--lattice_dir {consumer.root / "share" / "volt" / "lattices"}', argv)

    def test_missing_bundle_data_is_reported_not_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')
            consumer = _consumer(root / 'dxa')
            for path in sorted((consumer.root / 'share').rglob('*'), reverse=True):
                path.rmdir() if path.is_dir() else path.unlink()

            upstream = producer(dump, output_dir=root / 'out')
            with self.assertRaises(PluginError) as caught:
                consumer(upstream, output_dir=root / 'out')
            self.assertIn('share/volt/lattices', str(caught.exception))

    def test_partial_capability_is_not_provided_at_all(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm', artifacts=(
                'annotated.dump', 'clusters.table', 'cluster_transitions.table', 'atoms.parquet',
            ))
            consumer = _consumer(root / 'dxa')

            upstream = producer(dump, output_dir=root / 'out')
            self.assertNotIn(STRUCTURE_ID, upstream.provides)
            self.assertIn(STRUCTURE_ID, upstream.unmet)

            with self.assertRaises(PluginError) as caught:
                consumer(upstream, output_dir=root / 'out')
            message = str(caught.exception)
            self.assertIn('neighbor_lattice', message)
            self.assertIn('did not produce', message)

    def test_path_instead_of_run_is_refused_with_a_usable_message(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')
            consumer = _consumer(root / 'dxa')

            upstream = producer(dump, output_dir=root / 'out')
            with self.assertRaises(PluginError) as caught:
                consumer(upstream['annotated.dump'], output_dir=root / 'out')
            self.assertIn(STRUCTURE_ID, str(caught.exception))

    def test_fan_in_requirement_accepts_several_runs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            consumer = _consumer(root / 'som', **{
                'requires': [{
                    'id': 'features',
                    'capability': PER_ATOM,
                    'multiple': True,
                    'bind': {'atoms': '--features'},
                }],
                'input': None,
                'params': _params([
                    {'flag': '--features', 'type': 'path-list'},
                    {'flag': '--seed', 'type': 'int', 'default': '1982'},
                ]),
            })

            first = producer(dump, output_dir=root / 'a')
            second = producer(dump, output_dir=root / 'b')
            run = consumer(dump, output_dir=root / 'out', features=[first, second])

            argv = run['argv.txt'].path.read_text(encoding='utf-8')
            expected = ','.join([
                str(first.provides[PER_ATOM]['atoms']),
                str(second.provides[PER_ATOM]['atoms']),
            ])
            self.assertIn(f'--features {expected}', argv)

class ParameterTests(unittest.TestCase):
    def test_unknown_keyword_is_rejected_with_the_accepted_set(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            with self.assertRaises(PluginError) as caught:
                producer(dump, output_dir=root / 'out', rsmd=0.1)
            message = str(caught.exception)
            self.assertIn('rsmd', message)
            self.assertIn('rmsd', message)

    def test_enum_accepts_member_and_case_insensitive_string(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            by_member = producer(dump, output_dir=root / 'a', crystal_structure=Lattice.FCC)
            by_string = producer(dump, output_dir=root / 'b', crystal_structure='fcc')
            for run in (by_member, by_string):
                self.assertIn('--crystal_structure FCC', run['argv.txt'].path.read_text(encoding='utf-8'))

    def test_enum_outside_the_domain_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            with self.assertRaises(PluginError) as caught:
                producer(dump, output_dir=root / 'out', crystal_structure='FCCC')
            self.assertIn('FCC', str(caught.exception))

    def test_defaults_are_left_to_the_binary(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            run = producer(dump, output_dir=root / 'out')
            argv = run['argv.txt'].path.read_text(encoding='utf-8')
            self.assertNotIn('--rmsd', argv)
            self.assertNotIn('--crystal_structure', argv)

    def test_bool_is_emitted_as_the_cli_spelling(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dump = root / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(root / 'ptm')

            run = producer(dump, output_dir=root / 'out', dissolve_small_clusters=True)
            self.assertIn('--dissolve_small_clusters true', run['argv.txt'].path.read_text(encoding='utf-8'))

    def test_signature_and_doc_come_from_the_interface(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            consumer = _consumer(root / 'dxa')
            names = list(consumer.__signature__.parameters)
            self.assertIn('reference_topology', names)
            self.assertIn('line_smoothing_level', names)
            self.assertNotIn('structure', names)
            self.assertIn(STRUCTURE_ID, consumer.__doc__)

class ManifestValidationTests(unittest.TestCase):
    def test_edited_parameter_table_fails_the_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'ptm'
            _producer(root)
            manifest_path = root / 'plugin.json'
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            manifest['interface']['params']['options'].append(
                {'flag': '--invented', 'type': 'string', 'default': 'x'}
            )
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')

            with self.assertRaises(PluginError) as caught:
                Plugin('@voltlabs/producer', '1.0.0', root)
            self.assertIn('checksum', str(caught.exception))

    def test_missing_interface_block_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'legacy'
            (root / 'bin').mkdir(parents=True)
            (root / 'bin' / 'legacy').write_text('#!/bin/sh\n', encoding='utf-8')
            (root / 'plugin.json').write_text(json.dumps({'workflow': {'nodes': []}}), encoding='utf-8')

            with self.assertRaises(PluginError) as caught:
                Plugin('@voltlabs/legacy', '1.0.0', root)
            self.assertIn('interface', str(caught.exception))

    def test_wired_flags_leave_the_caller_surface(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            consumer = _consumer(Path(tmp) / 'dxa')
            self.assertNotIn('clusters_table', consumer.params)
            self.assertNotIn('neighbor_lattice', consumer.params)
            self.assertIn('reference_topology', consumer.params)

            dump = Path(tmp) / 'in.dump'
            dump.write_text('atoms', encoding='utf-8')
            producer = _producer(Path(tmp) / 'ptm')
            upstream = producer(dump, output_dir=Path(tmp) / 'out')
            with self.assertRaises(PluginError) as caught:
                consumer(upstream, output_dir=Path(tmp) / 'out', clusters_table='/tmp/mine.table')
            self.assertIn('clusters_table', str(caught.exception))

    def test_binding_a_flag_the_plugin_lacks_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'dxa'
            with self.assertRaises(PluginError) as caught:
                _consumer(root, requires=[{
                    'id': 'structure',
                    'capability': STRUCTURE_ID,
                    'bind': {'clusters_table': '--invented_flag'},
                }])
            self.assertIn('--invented_flag', str(caught.exception))

class ArtifactTests(unittest.TestCase):
    def test_artifact_lookup_is_exact_or_by_stem(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run = PluginRun(
                command=[], returncode=0, stdout='', stderr='',
                output_prefix=root / 'source', output_dir=root,
                artifacts={'dislocations.parquet': root / 'source_dislocations.parquet'},
            )
            run.artifacts['dislocations.parquet'].write_text('x', encoding='utf-8')

            self.assertEqual(run['dislocations.parquet'].name, 'dislocations.parquet')
            self.assertEqual(run['dislocations'].path.name, 'source_dislocations.parquet')
            with self.assertRaises(PluginError):
                run['dislocations.json']

if __name__ == '__main__':
    unittest.main()
