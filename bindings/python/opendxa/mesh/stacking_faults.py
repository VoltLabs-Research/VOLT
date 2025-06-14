from typing import List, Optional
import pyvista as pv
import numpy as np

def build_stacking_faults_mesh(stacking_fault_data: List) -> Optional[pv.PolyData]:
    if not isinstance(stacking_fault_data, list) or len(stacking_fault_data) == 0:
        return None
    
    stacking_fault_points = []
    stacking_fault_lines = []
    stacking_fault_point_offset = 0

    for stacking_fault in stacking_fault_data:
        if not (
            isinstance(stacking_fault, dict) and 'data' in stacking_fault and
            isinstance(stacking_fault['data'], dict) and 'consolidated' in stacking_fault['data']
        ):
            continue

        consolidated = stacking_fault['data']['consolidated']
        if not ('points' in consolidated and len(consolidated['points']) > 0):
            continue

        points = np.array([
            [p['position'][0], p['position'][1], p['position'][2]]
            for p in consolidated['points']
        ], dtype=float)
        
        stacking_fault_points.extend(points)
        if 'edges' in consolidated:
            for edge in consolidated['edges']:
                if 'vertices' in edge and len(edge['vertices']) >= 2:
                    vertices = edge['vertices']
                    line = [2, vertices[0] + stacking_fault_point_offset, vertices[1] + stacking_fault_point_offset]
                    stacking_fault_lines.extend(line)
        stacking_fault_point_offset += len(points)
    
    if not stacking_fault_points:
        return None
    
    if stacking_fault_lines: 
        return pv.PolyData(np.array(stacking_fault_points), lines=stacking_fault_lines)
    return pv.PolyData(np.array(stacking_fault_points))