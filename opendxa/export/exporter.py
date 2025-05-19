import numpy as np
import matplotlib.pyplot as plt
import json
import os

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
            output['loop_index'] = idx

        for idx, loop in enumerate(self.loops):
            points = self.positions[loop].tolist()
            burger_vector = self.burgers[idx].tolist()
            line_type = int(self.line_types[idx])
            output['dislocations'].append({
                'loop_index': idx,
                'type': line_type,
                'burgers': burger_vector,
                'points': points
            })

        with open(filename, 'a') as file:
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

