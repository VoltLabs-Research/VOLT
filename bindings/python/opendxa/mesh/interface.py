from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_interface_mesh(interface_data: Dict) -> Optional[pv.PolyData]:
    if not isinstance(interface_data, dict) or 'data' not in interface_data:
        return None
    
    data = interface_data['data']
    if not isinstance(data, dict):
        return None
    
    # Validate required components
    if 'points' not in data or 'edges' not in data:
        return None
    
    points_data = data['points']
    edges_data = data['edges']
    
    if not isinstance(points_data, list) or not isinstance(edges_data, list):
        return None
    
    if len(points_data) == 0:
        return None
    
    # Validate and extract points
    valid_points = []
    for point in points_data:
        if ('index' in point and 'position' in point and 
            isinstance(point['position'], list) and len(point['position']) == 3):
            valid_points.append(point)
    
    if not valid_points:
        return None
    
    interface_points = np.array([
        [p['position'][0], p['position'][1], p['position'][2]]
        for p in valid_points
    ], dtype=float)

    # Process edges
    interface_lines = []
    edge_counts = []
    stacking_fault_flags = []
    
    for edge in edges_data:
        if ('vertices' in edge and isinstance(edge['vertices'], list) and 
            len(edge['vertices']) == 2 and 'edge_count' in edge and 
            'is_stacking_fault' in edge):
            
            vertices = edge['vertices']
            # Validate vertex indices
            if (isinstance(vertices[0], int) and isinstance(vertices[1], int) and
                0 <= vertices[0] < len(valid_points) and 0 <= vertices[1] < len(valid_points)):
                
                line = [2, vertices[0], vertices[1]]
                interface_lines.extend(line)
                
                edge_counts.append(edge['edge_count'])
                stacking_fault_flags.append(edge['is_stacking_fault'])

    if not interface_lines:
        # Return point cloud if no valid edges
        mesh = pv.PolyData(interface_points)
    else:
        mesh = pv.PolyData(interface_points, lines=interface_lines)
        
        # Add cell data
        if edge_counts:
            mesh.cell_data['edge_count'] = np.array(edge_counts, dtype=int)
        if stacking_fault_flags:
            mesh.cell_data['is_stacking_fault'] = np.array(stacking_fault_flags, dtype=bool)
    
    return mesh