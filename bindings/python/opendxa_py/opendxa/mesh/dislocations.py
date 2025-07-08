from typing import List, Dict, Tuple, Optional, Any
import pyvista as pv
import numpy as np

def build_dislocation_mesh(dislocations_data: Dict) -> Tuple[Optional[pv.PolyData], Dict[str, Any]]:
    """Build a PyVista mesh from dislocations data in the new JSON format."""
    if not isinstance(dislocations_data, dict) or 'data' not in dislocations_data:
        return None, {}
    
    segments = dislocations_data['data']
    
    if not segments or not isinstance(segments, list):
        return None, {}
    
    all_points = []
    lines = []

    # Basic segment data
    burgers_vectors = []
    burgers_magnitudes = []
    segment_lengths = []
    segment_ids = []
    fractional_burgers_info = []
    line_directions = []
    is_closed_loops = []
    is_infinite_lines = []
    
    # Enhanced data from detailed export
    core_sizes_list = []
    average_core_sizes = []
    junction_info_list = []
    node_info_list = []
    circuit_info_list = []
    line_direction_strings = []
    
    point_offset = 0

    for segment in segments:
        # Validate required fields for new format
        required_fields = ['index', 'points', 'length', 'burgers']
        if not all(field in segment for field in required_fields):
            continue
        
        # Validate burgers structure
        burgers_info = segment['burgers']
        burgers_required = ['vector', 'magnitude', 'fractional']
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
            burgers_magnitudes.append(burgers_info['magnitude'])
            fractional_burgers_info.append(burgers_info['fractional'])
            
            segment_lengths.append(segment['length'])
            segment_ids.append(segment['index'])
            
            # Extract optional enhanced fields from detailed export
            if 'line_direction' in segment and 'vector' in segment['line_direction']:
                ld = segment['line_direction']['vector']
                line_directions.append([ld[0], ld[1], ld[2]])
                line_direction_strings.append(segment['line_direction'].get('string', ''))
            else:
                line_directions.append([0.0, 0.0, 0.0])
                line_direction_strings.append('')
            
            is_closed_loops.append(segment.get('is_closed_loop', False))
            is_infinite_lines.append(segment.get('is_infinite_line', False))
            
            # Extract core sizes if available
            core_sizes = segment.get('core_sizes', [])
            core_sizes_list.append(core_sizes)
            average_core_sizes.append(segment.get('average_core_size', 0.0))
            
            # Extract junction info if available
            junction_info = segment.get('junction_info', {})
            junction_info_list.append({
                'forms_junction': junction_info.get('forms_junction', False),
                'junction_arms_count': junction_info.get('junction_arms_count', 0),
                'backward_node_dangling': junction_info.get('backward_node_dangling', False),
                'forward_node_dangling': junction_info.get('forward_node_dangling', False)
            })
            
            # Extract node information if available
            nodes = segment.get('nodes', {})
            node_info = {
                'forward_node': nodes.get('forward', {}),
                'backward_node': nodes.get('backward', {})
            }
            node_info_list.append(node_info)
            
            # Extract circuit information if available
            circuit_info = {
                'forward_circuit': segment.get('forward_circuit', {}),
                'backward_circuit': segment.get('backward_circuit', {})
            }
            circuit_info_list.append(circuit_info)

            point_offset += num_points

    if not all_points:
        return None, {}

    points_array = np.array(all_points, dtype=float)
    mesh = pv.PolyData(points_array, lines=lines)

    # Add cell data
    mesh.cell_data['burgers_vector'] = np.array(burgers_vectors, dtype=float)
    mesh.cell_data['burgers_vector_magnitude'] = np.array(burgers_magnitudes, dtype=float)
    mesh.cell_data['segment_length'] = np.array(segment_lengths, dtype=float)
    mesh.cell_data['segment_id'] = np.array(segment_ids, dtype=int)
    mesh.cell_data['line_direction'] = np.array(line_directions, dtype=float)
    mesh.cell_data['is_closed_loop'] = np.array(is_closed_loops, dtype=bool)
    mesh.cell_data['is_infinite_line'] = np.array(is_infinite_lines, dtype=bool)
    mesh.cell_data['average_core_size'] = np.array(average_core_sizes, dtype=float)
    
    # Enhanced additional data
    additional_data = {
        'burgers_magnitudes': burgers_magnitudes,
        'segment_lengths': segment_lengths,
        'segment_ids': segment_ids,
        'fractional_burgers_info': fractional_burgers_info,
        'line_directions': line_directions,
        'line_direction_strings': line_direction_strings,
        'is_closed_loops': is_closed_loops,
        'is_infinite_lines': is_infinite_lines,
        'junction_info': junction_info_list,
        'node_info': node_info_list,
        'circuit_info': circuit_info_list,
        'core_sizes': core_sizes_list,
        'average_core_sizes': average_core_sizes,
        'summary': dislocations_data.get('summary', {}),
        'metadata': dislocations_data.get('metadata', {})
    }

    return mesh, additional_data