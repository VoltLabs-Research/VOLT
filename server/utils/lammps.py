from typing import Dict, List
import numpy as np

def extract_timesteps(lines: List[str]) -> List[int]:
    timesteps = []
    it = iter(lines)
    for line in it:
        if line.startswith('ITEM: TIMESTEP'):
            try:
                timestep_line = next(it)
                timesteps.append(int(timestep_line.strip()))
            except (StopIteration, ValueError):
                continue
    return timesteps

def read_lammps_dump(filepath: str) -> Dict[int, np.ndarray]:
    with open(filepath, 'r') as file:
        lines = file.readlines()

    num_atoms = 0
    coord_cols = []
    positions = []
    reading_atoms = False
    type_col = None
    types = []

    for i, line in enumerate(lines):
        line = line.strip()

        if line.startswith('ITEM: NUMBER OF ATOMS'):
            num_atoms = int(lines[i + 1].strip())
        
        elif line.startswith('ITEM: ATOMS'):
            # ['id', 'type', 'x', 'y', 'z', ...]
            header = line.split()[2:]
            coord_cols = [
                idx for idx, name in enumerate(header)
                if name in ('x', 'y', 'z', 'xs', 'ys', 'zs')
            ]
            if len(coord_cols) != 3:
                raise ValueError('Could not find x/y/z columns in ATOMS header.')
            
            if 'type' in header:
                type_col = header.index('type')
            else:
                raise ValueError('ATOM type column not found in header.')

            reading_atoms = True
            continue

        elif reading_atoms:
            if line.startswith('ITEM:'):
                break
            parts = line.split()
            try:
                position = [float(parts[i]) for i in coord_cols]
                atom_type = int(parts[type_col])
                positions.append(position)
                types.append(atom_type)

            except Exception as e:
                raise ValueError(f'Invalid line in atom data: {line}\n{e}')
    
    atoms_as_dict = [{
        'type': int(atom_type),
        'position': list(map(float, position))
    } for position, atom_type in zip(positions, types)]
    
    data = {
        'total_atoms': num_atoms,
        'atoms': atoms_as_dict
    }

    return data