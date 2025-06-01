from opendxa.kernels.neighbors import find_neighbors_unified_kernel
import numpy as np
import warnings

class HybridNeighborFinder:
    def __init__(
        self, positions, box_bounds,
        cutoff=3.5, num_neighbors=12,
        voronoi_factor=1.5, max_neighbors=64
    ):
        self.positions = np.asarray(positions, dtype=np.float64)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float64)
        self.cutoff = cutoff
        self.num_neighbors = num_neighbors
        self.voronoi_factor = voronoi_factor
        self.max_neighbors = max_neighbors

        # Validaciones
        if self.box_bounds.shape != (3,2):
            raise ValueError('box_bounds must be shape (3,2)')
        if np.any(self.box_bounds[:,1] <= self.box_bounds[:,0]):
            raise ValueError('Each box bound must have max > min')

        self.lx = self.box_bounds[0,1] - self.box_bounds[0,0]
        self.ly = self.box_bounds[1,1] - self.box_bounds[1,0]
        self.lz = self.box_bounds[2,1] - self.box_bounds[2,0]
        if not (0 < cutoff < min(self.lx, self.ly, self.lz)):
            raise ValueError('cutoff must be >0 and < each box dimension')
        if not (1 <= num_neighbors < len(self.positions)):
            raise ValueError('num_neighbors must be between 1 and N-1')
        if voronoi_factor <= 1.0:
            raise ValueError('voronoi_factor must be >1.0')

    @staticmethod
    def _build_dict(neigh_idx, counts):
        n = neigh_idx.shape[0]
        neigh = {i:set() for i in range(n)}
        for i in range(n):
            for k in range(counts[i]):
                j = int(neigh_idx[i, k])
                if 0 <= j < n:
                    neigh[i].add(j)
                    neigh[j].add(i)
        return {i: sorted(neigh[i]) for i in range(n)}

    def find_cutoff_neighbors(self):
        neigh_idx, counts = find_neighbors_unified_kernel(
            self.positions,
            self.box_bounds,
            self.cutoff,
            self.lx, self.ly, self.lz,
            self.max_neighbors
        )
        return self._build_dict(neigh_idx, counts)

    def find_voronoi_neighbors(self):
        enlarged_cutoff = self.cutoff * self.voronoi_factor
        neigh_idx, counts = find_neighbors_unified_kernel(
            self.positions,
            self.box_bounds,
            enlarged_cutoff,
            self.lx, self.ly, self.lz,
            self.max_neighbors
        )
        pool = self._build_dict(neigh_idx, counts)

        n = self.positions.shape[0]
        neigh = {i:[] for i in range(n)}
        for i in range(n):
            cand = pool[i]
            if len(cand) < self.num_neighbors:
                warnings.warn(
                    f"[HybridNeighborFinder] Atom {i}: only {len(cand)} "
                    f"candidates (<{self.num_neighbors}), using all available."
                )
                sel = cand.copy()
            else:
                d2 = [(j, np.sum((self.positions[j]-self.positions[i])**2)) for j in cand]
                d2.sort(key=lambda x: x[1])
                sel = [j for j,_ in d2[:self.num_neighbors]]
            neigh[i] = sel

        # simetrizar
        for i in range(n):
            for j in neigh[i]:
                if i not in neigh[j]:
                    neigh[j].append(i)
        return {i: sorted(neigh[i]) for i in range(n)}

    def find_neighbors(self):
        cn = self.find_cutoff_neighbors()
        vn = self.find_voronoi_neighbors()
        n = self.positions.shape[0]
        hybrid = {i: sorted(set(cn[i]).intersection(vn[i])) for i in range(n)}
        return hybrid
