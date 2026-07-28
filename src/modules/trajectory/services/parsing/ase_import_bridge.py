#!/usr/bin/env python3
"""ASE import bridge — reads a trajectory file via ase.io and streams JSON frames to stdout.

Usage:
    python ase_import_bridge.py <file_path>

Each output line is a JSON object:
  per-frame: { frame: <n>, natoms: <n>, cell: [[3x3]], pbc: [bool,bool,bool],
               symbols: [...], positions: [[x,y,z]...], properties: {name: [...],...} }
  error:     { error: "<message>" }

STDOUT is reserved for the JSON protocol. All diagnostics go to STDERR.
"""
import json
import sys


def _array_to_list(arr):
    try:
        return arr.tolist()
    except AttributeError:
        return list(arr)


def emit(obj):
    sys.stdout.write(json.dumps(obj, separators=(',', ':')) + '\n')
    sys.stdout.flush()


def run(file_path):
    try:
        import ase.io
    except ImportError as exc:
        emit({'error': f'ase not available: {exc}'})
        return

    try:
        frames = ase.io.iread(file_path, index=':')
    except Exception as exc:
        emit({'error': f'ase.io.iread failed: {exc}'})
        return

    for frame_index, atoms in enumerate(frames):
        try:
            cell = _array_to_list(atoms.get_cell())
            pbc = _array_to_list(atoms.get_pbc())
            symbols = list(atoms.get_chemical_symbols())
            positions = _array_to_list(atoms.get_positions())

            properties = {}
            for key, value in atoms.arrays.items():
                if key in ('positions', 'numbers'):
                    continue
                try:
                    properties[key] = _array_to_list(value)
                except Exception:
                    pass

            emit({
                'frame': frame_index,
                'natoms': len(atoms),
                'cell': cell,
                'pbc': pbc,
                'symbols': symbols,
                'positions': positions,
                'properties': properties
            })
        except Exception as exc:
            emit({'error': f'frame {frame_index}: {exc}'})
            return


if __name__ == '__main__':
    if len(sys.argv) < 2:
        emit({'error': 'usage: ase_import_bridge.py <file_path>'})
        sys.exit(1)
    run(sys.argv[1])
