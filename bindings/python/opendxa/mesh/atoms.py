from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_atom_mesh(atoms_data: Dict) -> Optional[pv.PolyData]:
    if not isinstance(atoms_data, dict) or 'data' not in atoms_data:
        return None
    
    atom_list = atoms_data['data']
    if not isinstance(atom_list, list) or len(atom_list) == 0:
        return None
    
    # Validate and extract data
    valid_atoms = []
    for atom in atom_list:
        # Validate required fields
        required_fields = ['node_id', 'position', 'cna', 'coordination', 'recursive_depth']
        if not all(field in atom for field in required_fields):
            continue
        
        # Validate position format
        if not isinstance(atom['position'], list) or len(atom['position']) != 3:
            continue
        
        # Validate CNA structure
        if not isinstance(atom['cna'], dict) or 'atom_type' not in atom['cna']:
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
        atom['cna']['atom_type']
        for atom in valid_atoms
    ], dtype=int)
    
    coordination_numbers = np.array([
        atom['coordination']
        for atom in valid_atoms
    ], dtype=int)
    
    recursive_depths = np.array([
        atom['recursive_depth']
        for atom in valid_atoms
    ], dtype=int)
    
    node_ids = np.array([
        atom['node_id']
        for atom in valid_atoms
    ], dtype=int)
    
    # Create mesh
    mesh = pv.PolyData(atom_points)
    mesh.point_data['atom_type'] = atom_types
    mesh.point_data['coordination'] = coordination_numbers
    mesh.point_data['recursive_depth'] = recursive_depths
    mesh.point_data['node_id'] = node_ids
    
    return mesh