from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_interface_mesh(interface_data: Dict) -> Optional[pv.PolyData]:
    if interface_data['metadata']['num_nodes'] == 0:
        return None
    
    interface_points = np.array([
        [p['position'][0], p['position'][1], p['position'][2]]
        for p in interface_data['points']
    ], dtype=float)

    interface_lines = []
    for edge in interface_data['edges']:
        vertices = edge['vertices']
        line = [2, vertices[0], vertices[1]]
        interface_lines.extend(line)

    return pv.PolyData(interface_points, lines=interface_lines)
    
