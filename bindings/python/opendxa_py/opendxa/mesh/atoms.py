from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_atom_mesh(atoms_data: Dict) -> Optional[pv.PolyData]:
    """Build a PyVista mesh from atoms data in the new JSON format."""
    if not isinstance(atoms_data, dict) or 'data' not in atoms_data:
        return None
    
    atom_list = atoms_data['data']
    if not isinstance(atom_list, list) or len(atom_list) == 0:
        return None
    
    # Validate and extract data
    valid_atoms = []
    for atom in atom_list:
        # Check required fields for new format
        required_fields = ['node_id', 'position', 'atom_type']
        if not all(field in atom for field in required_fields):
            continue
        
        # Validate position format
        if not isinstance(atom['position'], list) or len(atom['position']) != 3:
            continue
        
        valid_atoms.append(atom)
    
    if not valid_atoms:
        return None
    
    # Extract arrays
    atom_points = np.array([
        [atom['position'][0], atom['position'][1], atom['position'][2]] 
        for atom in valid_atoms
    ], dtype=float)

    atom_types = np.array([
        atom['atom_type']
        for atom in valid_atoms
    ], dtype=int)
    
    node_ids = np.array([
        atom['node_id']
        for atom in valid_atoms
    ], dtype=int)
    
    # Create mesh
    mesh = pv.PolyData(atom_points)
    mesh.point_data['atom_type'] = atom_types
    mesh.point_data['node_id'] = node_ids
    
    return mesh