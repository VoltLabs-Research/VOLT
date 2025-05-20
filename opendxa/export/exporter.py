from opendxa.utils.burgers import match_to_fcc_basis
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
        output_dir: str = 'dislocations'
    ):
        self.positions = np.asarray(positions, dtype=np.float32)
        self.output_dir = output_dir
        self.loops = loops
        self.burgers = burgers
        self.line_types = np.asarray(line_types, dtype=int)
        self.timestep = int(timestep)

    def to_json(self, filename: str):
        os.makedirs(self.output_dir, exist_ok=True)
        filename = os.path.join(self.output_dir, f'timestep_{self.timestep}.json')
        
        output = {
            'timestep': self.timestep,
            'dislocations': []
        }

        for idx, loop in enumerate(self.loops):
            points = self.positions[loop].tolist()
            burger_vector = self.burgers[idx].tolist()
            line_type = int(self.line_types[idx])
            matched_burgers, alignment = match_to_fcc_basis(burger_vector)
            output['dislocations'].append({
                'loop_index': idx,
                'type': line_type,
                'burgers': burger_vector,
                'points': points,
                'matched_burgers': matched_burgers.tolist(),
                'matched_burgers_str': burgers_to_string(matched_burgers),
                'alignment': float(alignment)
            })

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

