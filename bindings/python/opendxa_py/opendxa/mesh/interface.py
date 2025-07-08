from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_interface_mesh(interface_data: Dict) -> Optional[pv.PolyData]:
    """Build a PyVista mesh from interface mesh data in the new JSON format."""
    if not isinstance(interface_data, dict) or 'data' not in interface_data:
        return None
    
    data = interface_data['data']
    if not isinstance(data, dict):
        return None
    
    # Validate required components
    if 'points' not in data:
        return None
    
    points_data = data['points']
    
    if not isinstance(points_data, list) or len(points_data) == 0:
        return None
    
    # Extract points from the new format
    interface_points = []
    for point in points_data:
        if ('index' in point and 'position' in point and
            isinstance(point['position'], list) and len(point['position']) == 3):
            interface_points.append(point['position'])
    
    if not interface_points:
        return None
    
    interface_points = np.array(interface_points, dtype=float)

    # Check if we have edges (for line mesh) or facets (for triangle mesh)
    mesh = None
    
    if 'edges' in data and isinstance(data['edges'], list):
        # Build line mesh
        edges_data = data['edges']
        interface_lines = []
        edge_counts = []
        
        for edge in edges_data:
            if ('vertices' in edge and isinstance(edge['vertices'], list) and 
                len(edge['vertices']) == 2 and 'edge_count' in edge):
                
                vertices = edge['vertices']
                # Validate vertex indices
                if (isinstance(vertices[0], int) and isinstance(vertices[1], int) and
                    0 <= vertices[0] < len(interface_points) and 0 <= vertices[1] < len(interface_points)):
                    
                    line = [2, vertices[0], vertices[1]]
                    interface_lines.extend(line)
                    edge_counts.append(edge['edge_count'])

        if interface_lines:
            mesh = pv.PolyData(interface_points, lines=interface_lines)
            mesh.cell_data['edge_count'] = np.array(edge_counts, dtype=int)
    
    elif 'facets' in data and isinstance(data['facets'], list):
        # Build triangle mesh
        facets_data = data['facets']
        interface_faces = []
        
        for facet in facets_data:
            if ('vertices' in facet and isinstance(facet['vertices'], list) and 
                len(facet['vertices']) == 3):
                
                vertices = facet['vertices']
                # Validate vertex indices
                if all(isinstance(v, int) and 0 <= v < len(interface_points) for v in vertices):
                    face = [3] + vertices
                    interface_faces.extend(face)

        if interface_faces:
            mesh = pv.PolyData(interface_points, faces=interface_faces)
    
    # Fallback to point cloud if no edges or facets
    if mesh is None:
        mesh = pv.PolyData(interface_points)
    
    return mesh