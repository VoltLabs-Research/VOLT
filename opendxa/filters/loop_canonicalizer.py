import numpy as np

# Filters out geometrically equivalent redundant loops (rotations + PBC + rounding) to avoid counting the same loop multiple times.
class LoopCanonicalizer:
    def __init__(self, positions, box_bounds=None):
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32) if box_bounds is not None else None
        self.box_lengths = self.box_bounds[:,1] - self.box_bounds[:,0] if self.box_bounds is not None else None

    def _apply_pbc(self, diffs):
        for d in range(3):
            L = self.box_lengths[d]
            diffs[:, d][diffs[: ,d] >  0.5*L] -= L
            diffs[:, d][diffs[:, d] < -0.5*L] += L
        return diffs

    def _get_loop_geometry(self, loop):
        pts = self.positions[loop]
        diffs = np.roll(pts, -1, axis=0) - pts
        if self.box_bounds is not None:
            diffs = self._apply_pbc(diffs.copy())
        return diffs

    def _loop_hash(self, diffs):
        # Genera rotaciones y reversos
        n = len(diffs)
        variants = [np.roll(diffs, -i, axis=0) for i in range(n)]
        variants += [np.roll(diffs[::-1], -i, axis=0) for i in range(n)]
        strings = [';'.join(map(lambda v: f'{v[0]:.4f},{v[1]:.4f},{v[2]:.4f}', diff)) for diff in variants]
        return min(strings)

    def canonicalize(self, loops):
        seen = set()
        unique_loops = []
        for loop in loops:
            diffs = self._get_loop_geometry(loop)
            h = self._loop_hash(diffs)
            if h not in seen:
                seen.add(h)
                unique_loops.append(loop)
        return unique_loops
