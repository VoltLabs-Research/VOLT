from typing import List, Dict, Tuple
import pyvista as pv
import numpy as np
import math

def build_dislocation_mesh(segments: List[Dict]) -> Tuple[pv.PolyData, Dict[str, List]]:
    if not segment:
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
        segment_points = np.array(segment['points'], dtype=float)
        all_points.extend(segment_points)

        num_points = len(segment_points)
        if num_points > 0:
            line = [num_points] + list(range(point_offset, point_offset + num_points))
            lines.extend(line)

            bv = segment['burgers_vector']
            burgers_vectors.append([ bv[0], bv[1], bv[2] ])

            bv_world = segment.get('burgers_vector_world', bv)
            burgers_vectors_world.append([ bv_world[0], bv_world[1], bv_world[2] ])

            magnitude = math.sqrt(bv[0] ** 2 + bv[1] ** 2 + bv[2] ** 2)
            burgers_magnitudes.append(magnitude)

            segment_lengths.append(segment['length'])
            segment_ids.append(segment['index'])

            fractional_str = segment.get('fractional_burgers', f'[{bv[0], bv[1], bv[2]}]')
            fractional_burgers_info.append(fractional_str)

            point_offset += num_points

    # Create mesh
    points_array = np.array(all_points, dtype=float)
    mesh = pv.PolyData(points_array, lines=lines)

    # Add data to the cell
    mesh.cell_data['burgers_vector'] = np.array(burgers_vectors, dtype=float)
    mesh.cell_data['burgers_vector_world'] = np.array(burgers_vectors_world, dtype=float)
    mesh.cell_data['burgers_vector_magnitude'] = np.array(burgers_magnitudes, dtype=float)
    mesh.cell_data['segment_length'] = np.array(segment_lengths, dtype=float)
    mesh.cell_data['segment_id'] = np.array(segment_ids, dtype=int)
    
    # For stats
    additional_data = {
        'burgers_magnitudes': burgers_magnitudes,
        'segment_lengths': segment_lengths,
        'segment_ids': segment_ids,
        'fractional_burgers_info': fractional_burgers_info
    }

    return mesh, additional_data

