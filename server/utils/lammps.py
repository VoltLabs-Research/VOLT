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
    positions_by_timestep = {}

    with open(filepath, 'r') as file:
        line = file.readline()

        while line:
            if line.startswith('ITEM: TIMESTEP'):
                timestep = int(file.readline().strip())

                while line and not line.startswith('ITEM: ATOMS'):
                    line = file.readline()
                
                header_parts = line.strip().split()[2:]
                coord_cols = [
                    i for i, key in enumerate(header_parts)
                    if any(k in key for k in ['x', 'y', 'z'])
                ]
                atom_lines = []

                line = file.readline()
                while line and not line.startswith('ITEM:'):
                    parts = line.strip().split()
                    coords = [float(parts[i]) for i in coord_cols]
                    atom_lines.append(coords)
                    line = file.readline()

                positions = np.array(atom_lines)
                positions_by_timestep[timestep] = positions
            else:
                line = file.readline()

    return positions_by_timestep