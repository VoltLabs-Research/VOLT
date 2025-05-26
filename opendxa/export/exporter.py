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
        validation_result: dict = None
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

    def to_json(self, filename: str):
        os.makedirs(self.output_dir, exist_ok=True)
        filename = os.path.join(self.output_dir, f'timestep_{self.timestep}.json')
        
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
            
            # Detect crystal type and use appropriate matching
            crystal_type = 'fcc'  # default
            lattice_parameter = 1.0  # default
            
            # Try to get crystal info from classification if available
            if idx in self.burgers_classifications:
                classification = self.burgers_classifications[idx]
                crystal_type = classification.get('crystal_structure', 'fcc')
            
            # Use structure-aware matching
            matched_burgers, alignment = match_to_crystal_basis(
                np.array(burger_vector), crystal_type, lattice_parameter
            )
            
            # Keep FCC matching for backward compatibility
            fcc_matched_burgers, fcc_alignment = match_to_fcc_basis(burger_vector)
            
            dislocation_data = {
                'loop_index': idx,
                'type': line_type,
                'burgers': burger_vector,
                'points': points,
                'matched_burgers': matched_burgers.tolist(),
                'matched_burgers_str': burgers_to_string(matched_burgers),
                'alignment': float(alignment),
                'fcc_matched_burgers': fcc_matched_burgers.tolist(),
                'fcc_alignment': float(fcc_alignment)
            }
            
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

        with open(filename, 'w') as file:
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

