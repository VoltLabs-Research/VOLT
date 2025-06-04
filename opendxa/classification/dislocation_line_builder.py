import numpy as np

class DislocationLineBuilder:
    def __init__(self, positions, loops, burgers, threshold=1e-3):
        self.positions = np.asarray(positions, dtype=np.float32)
        self.loops = loops
        self.burgers = burgers
        self.thresh = threshold

    def build_lines(self):
        lines = []
        for idx, b in self.burgers.items():
            if np.linalg.norm(b) < self.thresh: continue
            loop = self.loops[idx]
            pts = self.positions[loop]
            lines.append(pts)
        return lines