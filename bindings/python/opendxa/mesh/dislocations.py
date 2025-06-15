from typing import List, Dict, Tuple, Optional
import pyvista as pv
import numpy as np

def build_dislocation_mesh(dislocations_data: Dict) -> Tuple[Optional[pv.PolyData], Dict[str, List]]:
    if not isinstance(dislocations_data, dict) or 'data' not in dislocations_data:
        return None, {}
    
    segments = dislocations_data['data']
    
    if not segments or not isinstance(segments, list):
        return None, {}
    
    all_points = []
    lines = []

    burgers_vectors = []
    burgers_vectors_world = []
    burgers_magnitudes = []
    segment_lengths = []
    segment_ids = []
    fractional_burgers_info = []
    
    point_offset = 0

    for segment in segments:
        # Validate required fields
        required_fields = ['index', 'points', 'length', 'burgers']
        if not all(field in segment for field in required_fields):
            continue
        
        # Validate burgers structure
        burgers_info = segment['burgers']
        burgers_required = ['vector', 'vector_world', 'magnitude', 'fractional']
        if not all(field in burgers_info for field in burgers_required):
            continue
        
        segment_points = np.array(segment['points'], dtype=float)
        all_points.extend(segment_points)

        num_points = len(segment_points)
        if num_points > 0:
            line = [num_points] + list(range(point_offset, point_offset + num_points))
            lines.extend(line)

            # Extract burgers data
            bv = burgers_info['vector']
            burgers_vectors.append([bv[0], bv[1], bv[2]])

            bv_world = burgers_info['vector_world']
            burgers_vectors_world.append([bv_world[0], bv_world[1], bv_world[2]])

            burgers_magnitudes.append(burgers_info['magnitude'])
            segment_lengths.append(segment['length'])
            segment_ids.append(segment['index'])
            fractional_burgers_info.append(burgers_info['fractional'])

            point_offset += num_points

    if not all_points:
        return None, {}

    points_array = np.array(all_points, dtype=float)
    mesh = pv.PolyData(points_array, lines=lines)

    mesh.cell_data['burgers_vector'] = np.array(burgers_vectors, dtype=float)
    mesh.cell_data['burgers_vector_world'] = np.array(burgers_vectors_world, dtype=float)
    mesh.cell_data['burgers_vector_magnitude'] = np.array(burgers_magnitudes, dtype=float)
    mesh.cell_data['segment_length'] = np.array(segment_lengths, dtype=float)
    mesh.cell_data['segment_id'] = np.array(segment_ids, dtype=int)
    
    additional_data = {
        'burgers_magnitudes': burgers_magnitudes,
        'segment_lengths': segment_lengths,
        'segment_ids': segment_ids,
        'fractional_burgers_info': fractional_burgers_info
    }

    return mesh, additional_data