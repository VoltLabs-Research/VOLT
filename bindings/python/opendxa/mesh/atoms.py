from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_atom_mesh(atoms_data: Dict) -> Optional[pv.PolyData]:
    if atoms_data['metadata']['num_atoms'] == 0:
        return None
    
    atom_points = np.array([ 
        [atom['position'][0], atom['position'][1], atom['position'][2]] 
        for atom in atoms_data['data']
    ], dtype=float)

    atom_types = np.array([
        atom['cna']['atom_type']
        for atom in atoms_data['data']
    ])
    
    mesh = pv.PolyData(atom_points)
    mesh.point_data['atom_type'] = atom_types
    return mesh