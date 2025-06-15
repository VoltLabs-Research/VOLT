from typing import Dict, Optional
import pyvista as pv
import numpy as np

def build_stacking_faults_mesh(stacking_fault_data: Dict) -> Optional[pv.PolyData]:
    if not isinstance(stacking_fault_data, dict) or 'data' not in stacking_fault_data:
        return None
    
    faults_list = stacking_fault_data['data']
    if not isinstance(faults_list, list) or len(faults_list) == 0:
        return None
    
    stacking_fault_points = []
    stacking_fault_lines = []
    stacking_fault_point_offset = 0
    
    contour_ids = []
    edge_indices = []
    fault_indices = []

    for fault_idx, stacking_fault in enumerate(faults_list):
        if not isinstance(stacking_fault, dict):
            continue

        required_fields = ['index', 'is_invalid', 'normal_vector', 'center', 
                          'base_point', 'atom_counts', 'is_infinite']
        if not all(field in stacking_fault for field in required_fields):
            continue
        
        if stacking_fault.get('is_invalid', False):
            continue
        
        if 'data' not in stacking_fault:
            continue
            
        sf_data = stacking_fault['data']
        
        if 'consolidated' in sf_data and 'points' in sf_data['consolidated']:
            consolidated = sf_data['consolidated']
            
            if len(consolidated['points']) == 0:
                continue

            points = np.array([
                [p['position'][0], p['position'][1], p['position'][2]]
                for p in consolidated['points']
                if 'position' in p and len(p['position']) == 3
            ], dtype=float)
            
            if len(points) == 0:
                continue
            
            stacking_fault_points.extend(points)
            
            if 'edges' in consolidated:
                for edge in consolidated['edges']:
                    if 'vertices' in edge and len(edge['vertices']) >= 2:
                        vertices = edge['vertices']
                        line = [2, vertices[0] + stacking_fault_point_offset, vertices[1] + stacking_fault_point_offset]
                        stacking_fault_lines.extend(line)
                        
                        contour_ids.append(edge.get('contour_id', 0))
                        edge_indices.append(edge.get('edge_index_global', 0))
                        fault_indices.append(fault_idx)
            
            stacking_fault_point_offset += len(points)
            
        elif 'contours' in sf_data:
            for contour_id, contour in enumerate(sf_data['contours']):
                if not isinstance(contour, dict) or 'data' not in contour:
                    continue
                    
                contour_data = contour['data']
                if 'points' not in contour_data:
                    continue
                    
                points = np.array([
                    [p['position'][0], p['position'][1], p['position'][2]]
                    for p in contour_data['points']
                    if 'position' in p and len(p['position']) == 3
                ], dtype=float)
                
                if len(points) == 0:
                    continue
                
                stacking_fault_points.extend(points)
                
                if 'edges' in contour_data:
                    for edge in contour_data['edges']:
                        if 'vertices' in edge and len(edge['vertices']) >= 2:
                            vertices = edge['vertices']
                            line = [2, vertices[0] + stacking_fault_point_offset, vertices[1] + stacking_fault_point_offset]
                            stacking_fault_lines.extend(line)
                            
                            contour_ids.append(contour_id)
                            edge_indices.append(edge.get('edge_index', 0))
                            fault_indices.append(fault_idx)
                
                stacking_fault_point_offset += len(points)
    
    if not stacking_fault_points:
        return None
    
    mesh = None
    if stacking_fault_lines: 
        mesh = pv.PolyData(np.array(stacking_fault_points), lines=stacking_fault_lines)
        
        # Add cell data
        if contour_ids:
            mesh.cell_data['contour_id'] = np.array(contour_ids, dtype=int)
        if edge_indices:
            mesh.cell_data['edge_index'] = np.array(edge_indices, dtype=int)
        if fault_indices:
            mesh.cell_data['fault_index'] = np.array(fault_indices, dtype=int)
    else:
        mesh = pv.PolyData(np.array(stacking_fault_points))
    
    return mesh