import numpy as np
import json
import matplotlib.pyplot as plt

class DislocationExporter:
    def __init__(
        self, positions, loops, burgers, line_types
    ):
        self.positions = np.asarray(positions, dtype=np.float32)
        self.loops = loops
        self.burgers = burgers
        self.line_types = line_types

    def to_json(self, filename):
        data = []
        for idx, loop in enumerate(self.loops):
            pts = self.positions[loop].tolist()
            bvec = self.burgers[idx].tolist()
            ltype = int(self.line_types[idx])
            data.append({
                'loop_index': idx,
                'type': ltype,
                'burgers': bvec,
                'points': pts
            })
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)

    def plot_lines(self, ax=None):
        if ax is None:
            fig = plt.figure(); ax = fig.add_subplot(111, projection='3d')
        colors = {0:'r',1:'b',2:'g'}  # edge:red, screw:blue, mixed:green
        for idx, loop in enumerate(self.loops):
            pts = self.positions[loop]
            c = colors.get(self.line_types[idx], 'k')
            ax.plot(pts[:,0], pts[:,1], pts[:,2], c=c)
        return ax