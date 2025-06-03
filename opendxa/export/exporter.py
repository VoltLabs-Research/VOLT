from opendxa.utils.burgers import match_to_fcc_basis, match_to_crystal_basis
from fractions import Fraction
import numpy as np
import matplotlib.pyplot as plt
import json
import os

def burgers_to_string(bvec: list[float]) -> str:
    fractions = [Fraction(b).limit_denominator(6) for b in bvec]
    denominators = [f.denominator for f in fractions]
    common_den = np.lcm.reduce(denominators)
    numerators = [int(f * common_den) for f in fractions]
    return f'1/{common_den}[{numerators[0]} {numerators[1]} {numerators[2]}]'

def generate_segments(points: list, segment_length: float = None, min_segments: int = 5) -> list:
    """
    Generate segments from a list of 3D points representing a dislocation line.
    
    Args:
        points: List of 3D coordinates representing the dislocation line
        segment_length: Target length for each segment (if None, auto-calculate)
        min_segments: Minimum number of segments to generate
    
    Returns:
        List of segments, where each segment is a dict with 'start' and 'end' points
    """
    if len(points) < 2:
        return []
    
    points_array = np.array(points)
    segments = []
    
    # Calculate cumulative distances along the line
    distances = np.zeros(len(points))
    for i in range(1, len(points)):
        segment_dist = np.linalg.norm(points_array[i] - points_array[i-1])
        distances[i] = distances[i-1] + segment_dist
    
    total_length = distances[-1]
    
    # Determine segment length
    if segment_length is None:
        # Auto-calculate based on total length and minimum segments
        segment_length = total_length / max(min_segments, len(points) // 4)
    
    # Generate segments
    current_distance = 0
    start_idx = 0
    
    while current_distance < total_length and start_idx < len(points) - 1:
        target_distance = min(current_distance + segment_length, total_length)
        
        # Find the end point for this segment
        end_idx = start_idx + 1
        while end_idx < len(points) and distances[end_idx] < target_distance:
            end_idx += 1
        
        if end_idx >= len(points):
            end_idx = len(points) - 1
        
        # Interpolate if needed for more precise segment endpoints
        if end_idx < len(points) - 1 and distances[end_idx] > target_distance:
            # Interpolate between end_idx-1 and end_idx
            prev_dist = distances[end_idx - 1]
            next_dist = distances[end_idx]
            ratio = (target_distance - prev_dist) / (next_dist - prev_dist)
            end_point = (points_array[end_idx - 1] * (1 - ratio) + 
                        points_array[end_idx] * ratio).tolist()
        else:
            end_point = points[end_idx]
        
        segments.append({
            'start': points[start_idx],
            'end': end_point,
            'start_index': start_idx,
            'end_index': end_idx if end_idx < len(points) else len(points) - 1,
            'length': target_distance - current_distance
        })
        
        # Move to next segment
        current_distance = target_distance
        start_idx = end_idx if end_idx < len(points) - 1 else len(points) - 1
    
    return segments

class DislocationExporter:
    def __init__(self,
        positions: np.ndarray,
        loops: list,
        burgers: dict,
        line_types: np.ndarray,
        timestep: int,
        output_dir: str = 'dislocations',
        burgers_classifications: dict = None,
        structure_analysis: dict = None,
        validation_result: dict = None,
        segment_length: float = None,
        min_segments: int = 5,
        include_segments: bool = True,
        lattice_parameter: float = 1.0,
        crystal_type: str = 'fcc'
    ):
        self.positions = np.asarray(positions, dtype=np.float32)
        self.output_dir = output_dir
        self.loops = loops
        self.burgers = burgers
        self.line_types = np.asarray(line_types, dtype=int)
        self.timestep = int(timestep)
        self.burgers_classifications = burgers_classifications or {}
        self.structure_analysis = structure_analysis or {}
        self.validation_result = validation_result or {}
        self.segment_length = segment_length
        self.min_segments = min_segments
        self.include_segments = include_segments
        self.lattice_parameter = lattice_parameter
        self.crystal_type = crystal_type

    def to_json(self, ctx):
        # If filename is provided, use it directly (for API calls)
        # Otherwise, use the default output directory structure
        # if filename and os.path.isabs(filename):
        #    # Absolute path provided (likely from API), use it directly
        #    output_filename = filename
        #    # Create directory if needed
        #    os.makedirs(os.path.dirname(output_filename), exist_ok=True)
        #else:
        #    # Relative path or no path - use output_dir structure
        #    os.makedirs(self.output_dir, exist_ok=True)
        #    output_filename = os.path.join(self.output_dir, filename or f'timestep_{self.timestep}.json')
        os.makedirs(self.output_dir, exist_ok=True)
        output_filename = os.path.join(self.output_dir, f'timestep_{self.timestep}.json')
        
        output = {
            'timestep': self.timestep,
            'dislocations': [],
            'analysis_metadata': {
                'total_loops': len(self.loops),
                'classification_available': bool(self.burgers_classifications),
                'structure_analysis_available': bool(self.structure_analysis)
            }
        }

        for idx, loop in enumerate(self.loops):
            points = self.positions[loop].tolist()
            burger_vector = self.burgers[idx].tolist()
            line_type = int(self.line_types[idx])
            
            # Generate segments if requested
            segments = []
            if self.include_segments:
                segments = generate_segments(
                    points, 
                    segment_length=self.segment_length, 
                    min_segments=self.min_segments
                )
            
            # Use detected crystal structure from PTM/CNA analysis if available
            # TODO: PTM and CNA have a method for inferring
            # TODO: structure types, but UnifiedBurgersVectors already does this. Fix that.
            #if idx in self.burgers_classifications:
            #    classification = self.burgers_classifications[idx]
            #    crystal_type = classification.get('crystal_structure', 'fcc')
            #    # We could also extract lattice parameter from classification if available
            crystal_type = self.crystal_type

            # Use structure-aware matching with the detected crystal type
            matched_burgers, alignment = match_to_crystal_basis(
                # TODO: HARDCODED CRYSTAL_TYPE
                np.array(burger_vector), crystal_type, self.lattice_parameter
            )
            
            # Build dislocation data
            dislocation_data = {
                'loop_index': idx,
                'type': line_type,
                'burgers': burger_vector,
                'points': points,
                # TODO: hardcoded
                'crystal_type': crystal_type,
                'matched_burgers': matched_burgers.tolist(),
                'matched_burgers_str': burgers_to_string(matched_burgers),
                'alignment': float(alignment)
            }
            
            if segments:
                dislocation_data['segments'] = segments
                dislocation_data['segment_count'] = len(segments)
                dislocation_data['total_line_length'] = sum(seg['length'] for seg in segments)
            
            # Add extended classification if available
            if idx in self.burgers_classifications:
                classification = self.burgers_classifications[idx]
                dislocation_data['classification'] = {
                    'crystal_structure': classification.get('crystal_structure', 'unknown'),
                    'dislocation_type': classification.get('dislocation_type', 'unknown'),
                    'family': classification.get('family', 'unknown'),
                    'is_standard': classification.get('is_standard', False),
                    'magnitude': float(classification.get('magnitude', 0.0))
                }
                
                # Add standard vector information if available
                if 'standard_vector' in classification:
                    std_vec = classification['standard_vector']
                    dislocation_data['classification']['standard_vector'] = std_vec.tolist()
                    dislocation_data['classification']['match_error'] = float(classification.get('match_error', 0.0))
            
            # Add structure analysis if available
            if idx in self.structure_analysis:
                structure_info = self.structure_analysis[idx]
                dislocation_data['local_structure'] = {
                    'dominant_structure': structure_info.get('dominant_structure', 'unknown'),
                    'structure_fractions': structure_info.get('structure_fractions', {}),
                    'total_atoms': structure_info.get('total_atoms', len(loop))
                }
            
            output['dislocations'].append(dislocation_data)
        
        # Add validation statistics if available
        if self.validation_result:
            primary_validation = self.validation_result.get('primary_validation', {})
            validation_stats = primary_validation.get('stats', {})
            
            output['validation_summary'] = {
                'total_validated': len(self.validation_result.get('final_validation', {}).get('valid_loops', [])),
                'structure_statistics': validation_stats,
                'consistency_score': self.validation_result.get('consistency_metrics', {}).get('overall_consistency', 0.0)
            }

        with open(output_filename, 'w') as file:
            json.dump(output, file, indent=2)

    def plot_lines(self, ax=None):
        if ax is None:
            fig = plt.figure()
            ax  = fig.add_subplot(111, projection='3d')

        color_map = {0:'r', 1:'b', 2:'g'}
        for idx, loop in enumerate(self.loops):
            pts = self.positions[loop]
            c   = color_map.get(self.line_types[idx], 'k')
            ax.plot(pts[:,0], pts[:,1], pts[:,2], color=c)

        ax.set_title(f'Dislocations @ timestep {self.timestep}')
        return ax

