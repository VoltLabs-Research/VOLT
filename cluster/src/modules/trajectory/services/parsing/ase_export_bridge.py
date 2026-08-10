#!/usr/bin/env python3
"""ASE export bridge — reads a per-atom Parquet file and writes a simulation format.

Usage:
    python ase_export_bridge.py <parquet_path> <output_path> <format> <column_mapping_json> [<ase_kwargs_json>]

Exits 0 on success, 1 on failure (error message to stderr).

column_mapping_json: JSON object mapping role names to Parquet column names.
  Required roles: "x", "y", "z" (position columns).
  Optional roles: "type" (int), "symbol" (str), "vx"/"vy"/"vz" (velocities),
                  "fx"/"fy"/"fz" (forces), "q" (charge),
                  "custom:<name>" (extra per-atom data, stored in atoms.arrays).

format: one of "lammps-dump", "lammps-data", "extxyz", "poscar", "cif"
"""
import json
import sys


# Formats handled natively (not via ASE write)
NATIVE_FORMATS = {'lammps-dump'}

# ASE format keyword for formats delegated to ase.io.write
ASE_FORMAT_MAP = {
    'lammps-data': 'lammps-data',
    'extxyz': 'extxyz',
    'poscar': 'vasp',
    'cif': 'cif',
}


def _write_lammps_dump(output_path, positions, type_ids, col_mapping, table, custom_cols):
    """Write a minimal LAMMPS dump text file from flat arrays."""
    natoms = len(positions)
    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]
    zs = [p[2] for p in positions]
    xlo, xhi = (min(xs) - 0.5, max(xs) + 0.5) if xs else (0.0, 1.0)
    ylo, yhi = (min(ys) - 0.5, max(ys) + 0.5) if ys else (0.0, 1.0)
    zlo, zhi = (min(zs) - 0.5, max(zs) + 0.5) if zs else (0.0, 1.0)

    header_cols = ['id', 'type', 'x', 'y', 'z']
    header_cols += list(custom_cols.keys())

    lines = [
        'ITEM: TIMESTEP', '0',
        'ITEM: NUMBER OF ATOMS', str(natoms),
        'ITEM: BOX BOUNDS pp pp pp',
        f'{xlo:.10g} {xhi:.10g}',
        f'{ylo:.10g} {yhi:.10g}',
        f'{zlo:.10g} {zhi:.10g}',
        'ITEM: ATOMS ' + ' '.join(header_cols),
    ]

    for i in range(natoms):
        row_vals = [str(i + 1), str(type_ids[i]), f'{xs[i]:.10g}', f'{ys[i]:.10g}', f'{zs[i]:.10g}']
        for col_data in custom_cols.values():
            row_vals.append(str(col_data[i]))
        lines.append(' '.join(row_vals))

    with open(output_path, 'w') as fh:
        fh.write('\n'.join(lines) + '\n')


def main():
    if len(sys.argv) < 5:
        print('usage: ase_export_bridge.py <parquet> <output> <format> <col_mapping_json> [<ase_kwargs_json>]', file=sys.stderr)
        sys.exit(1)

    parquet_path = sys.argv[1]
    output_path = sys.argv[2]
    fmt = sys.argv[3]
    col_mapping = json.loads(sys.argv[4])
    ase_kwargs = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}

    if fmt not in NATIVE_FORMATS and fmt not in ASE_FORMAT_MAP:
        print(f'unsupported format: {fmt}', file=sys.stderr)
        sys.exit(1)

    try:
        import pyarrow.parquet as pq
    except ImportError as exc:
        print(f'pyarrow not available: {exc}', file=sys.stderr)
        sys.exit(1)

    try:
        import numpy as np
    except ImportError as exc:
        print(f'numpy not available: {exc}', file=sys.stderr)
        sys.exit(1)

    # Read Parquet
    try:
        table = pq.read_table(parquet_path)
    except Exception as exc:
        print(f'failed to read parquet {parquet_path}: {exc}', file=sys.stderr)
        sys.exit(1)

    col_names = set(table.schema.names)

    # Validate required position columns
    for role in ('x', 'y', 'z'):
        col = col_mapping.get(role)
        if not col:
            print(f'column mapping missing required role "{role}"', file=sys.stderr)
            sys.exit(1)
        if col not in col_names:
            print(f'column "{col}" (role "{role}") not found in parquet; available: {sorted(col_names)}', file=sys.stderr)
            sys.exit(1)

    def getcol(role):
        name = col_mapping.get(role)
        if name and name in col_names:
            return table.column(name).to_pylist()
        return None

    xs = getcol('x')
    ys = getcol('y')
    zs = getcol('z')
    natoms = len(xs)
    positions = list(zip(xs, ys, zs))

    # Build type IDs (1-indexed integer)
    type_col = getcol('type')
    symbol_col = getcol('symbol')
    if type_col is not None:
        type_ids = [int(t) for t in type_col]
    elif symbol_col is not None:
        unique_syms = list(dict.fromkeys(str(s) for s in symbol_col))
        sym_to_type = {s: i + 1 for i, s in enumerate(unique_syms)}
        type_ids = [sym_to_type[str(s)] for s in symbol_col]
    else:
        type_ids = [1] * natoms

    # Collect custom columns
    custom_cols = {}
    for role, colname in col_mapping.items():
        if role.startswith('custom:'):
            array_name = role[len('custom:'):]
            if colname not in col_names:
                print(f'custom column "{colname}" not found in parquet', file=sys.stderr)
                sys.exit(1)
            custom_cols[array_name] = table.column(colname).to_pylist()

    # --- LAMMPS dump: native writer (ASE can't write this format) ---
    if fmt == 'lammps-dump':
        try:
            _write_lammps_dump(output_path, positions, type_ids, col_mapping, table, custom_cols)
        except Exception as exc:
            print(f'lammps-dump write failed: {exc}', file=sys.stderr)
            sys.exit(1)
        return

    # --- All other formats: delegate to ASE ---
    try:
        import ase
        import ase.io
    except ImportError as exc:
        print(f'ase not available: {exc}', file=sys.stderr)
        sys.exit(1)

    # Build ASE Atoms object
    pos_arr = np.array(positions, dtype=float)

    # Build symbols for ASE (must be valid chemical element symbols)
    if symbol_col is not None:
        # Validate against ASE's known elements
        from ase.data import chemical_symbols as _ase_syms
        valid_set = set(_ase_syms)
        raw_syms = [str(s) for s in symbol_col]
        if all(s in valid_set for s in raw_syms):
            symbols = raw_syms
        else:
            # Fall back to type-based dummy symbols
            symbols = None
    else:
        symbols = None

    if symbols is None:
        # Map type IDs to dummy element symbols using small real elements (H=1, He=2, Li=3...)
        from ase.data import chemical_symbols as _ase_syms
        unique_types = sorted(set(type_ids))
        type_to_sym = {t: _ase_syms[min(i + 1, len(_ase_syms) - 1)] for i, t in enumerate(unique_types)}
        symbols = [type_to_sym[t] for t in type_ids]

    atoms = ase.Atoms(symbols=symbols, positions=pos_arr)

    # Unit cell — required for POSCAR/CIF. If cell_a/b/c roles are present use them;
    # otherwise build a padded orthorhombic cell from the bounding box.
    cell_a = getcol('cell_a')  # lattice vector component axx, axy, axz as separate cols? No — optional 3-vector
    if fmt in ('poscar', 'cif'):
        if pos_arr.shape[0] > 0:
            mins = pos_arr.min(axis=0)
            maxs = pos_arr.max(axis=0)
            extents = maxs - mins + 5.0  # 5 Å padding
            atoms.set_cell(np.diag(extents))
            atoms.set_pbc(True)
            # Shift positions to be non-negative inside the cell
            atoms.positions -= mins

    # Velocities
    vx, vy, vz = getcol('vx'), getcol('vy'), getcol('vz')
    if vx is not None and vy is not None and vz is not None:
        atoms.set_velocities(np.array(list(zip(vx, vy, vz)), dtype=float))

    # Forces
    fx, fy, fz = getcol('fx'), getcol('fy'), getcol('fz')
    if fx is not None and fy is not None and fz is not None:
        atoms.arrays['forces'] = np.array(list(zip(fx, fy, fz)), dtype=float)

    # Charges
    q = getcol('q')
    if q is not None:
        atoms.set_initial_charges(np.array(q, dtype=float))

    # Custom arrays
    for array_name, col_data in custom_cols.items():
        try:
            arr = np.array(col_data)
        except Exception:
            arr = np.array(col_data, dtype=object)
        atoms.arrays[array_name] = arr

    ase_format = ASE_FORMAT_MAP[fmt]
    write_kwargs = dict(ase_kwargs)
    write_kwargs['format'] = ase_format
    try:
        ase.io.write(output_path, atoms, **write_kwargs)
    except Exception as exc:
        print(f'ase.io.write failed: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
