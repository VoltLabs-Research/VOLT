import numpy as np
import warnings
from numba import njit, prange

@njit
def build_cell_list(positions, box_bounds, cutoff, lx, ly, lz):
    n = positions.shape[0]
    # compute number of cells per dimension
    nx = max(1, int(lx // cutoff))
    ny = max(1, int(ly // cutoff))
    nz = max(1, int(lz // cutoff))
    dx = lx / nx
    dy = ly / ny
    dz = lz / nz

    head   = -1 * np.ones(nx * ny * nz, np.int64)
    linked = -1 * np.ones(n, np.int64)

    for i in range(n):
        xi, yi, zi = positions[i]
        cx = int((xi - box_bounds[0,0]) / dx) % nx
        cy = int((yi - box_bounds[1,0]) / dy) % ny
        cz = int((zi - box_bounds[2,0]) / dz) % nz
        idx = cx + cy*nx + cz*nx*ny
        linked[i] = head[idx]
        head[idx]   = i

    return head, linked, nx, ny, nz, dx, dy, dz

@njit
def pbc_distance2(xi, yi, zi, xj, yj, zj, lx, ly, lz):
    """
    Compute squared distance with periodic boundaries.
    """
    dx = xj - xi
    dy = yj - yi
    dz = zj - zi
    if dx >  0.5*lx: dx -= lx
    elif dx < -0.5*lx: dx += lx
    if dy >  0.5*ly: dy -= ly
    elif dy < -0.5*ly: dy += ly
    if dz >  0.5*lz: dz -= lz
    elif dz < -0.5*lz: dz += lz
    return dx*dx + dy*dy + dz*dz

@njit(parallel=True)
def cutoff_neighbors(
    positions, box_bounds, cutoff,
    head, linked, nx, ny, nz, dx, dy, dz,
    lx, ly, lz, max_neighbors
):
    n = positions.shape[0]
    cutoff2 = cutoff*cutoff

    # Initialize output arrays
    neigh_idx = -1 * np.ones((n, max_neighbors), np.int64)
    counts    = np.zeros(n,         np.int64)

    for i in prange(n):
        xi, yi, zi = positions[i]
        cx = int((xi - box_bounds[0,0]) / dx) % nx
        cy = int((yi - box_bounds[1,0]) / dy) % ny
        cz = int((zi - box_bounds[2,0]) / dz) % nz

        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                for oz in (-1, 0, 1):
                    ncx = (cx+ox) % nx
                    ncy = (cy+oy) % ny
                    ncz = (cz+oz) % nz
                    idx = ncx + ncy*nx + ncz*nx*ny
                    j = head[idx]
                    while j != -1:
                        if j > i:
                            dist2 = pbc_distance2(
                                xi, yi, zi,
                                positions[j,0], positions[j,1], positions[j,2],
                                lx, ly, lz
                            )
                            if dist2 <= cutoff2:
                                cnt = counts[i]
                                if cnt < max_neighbors:
                                    neigh_idx[i, cnt] = j
                                    counts[i] += 1
                        j = linked[j]
    return neigh_idx, counts

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

        # Validate inputs
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
    def find_cutoff_neighbors(
        positions, box_bounds, cutoff,
        lx, ly, lz, max_neighbors
    ):
        head, linked, nx, ny, nz, dx, dy, dz = build_cell_list(
            positions, box_bounds, cutoff, lx, ly, lz
        )
        neigh_idx, counts = cutoff_neighbors(
            positions, box_bounds, cutoff,
            head, linked, nx, ny, nz, dx, dy, dz,
            lx, ly, lz, max_neighbors
        )
        # build Python dict, symmetrize
        n = positions.shape[0]
        neigh = {i:set() for i in range(n)}
        for i in range(n):
            for k in range(counts[i]):
                j = int(neigh_idx[i,k])
                if 0 <= j < n:
                    neigh[i].add(j)
                    neigh[j].add(i)
        return {i:sorted(neigh[i]) for i in range(n)}

    @staticmethod
    def find_voronoi_neighbors(
        positions, box_bounds, num_neighbors,
        cutoff, voronoi_factor, max_neighbors
    ):
        pool = HybridNeighborFinder.find_cutoff_neighbors(
            positions, box_bounds,
            cutoff * voronoi_factor,
            box_bounds[0,1]-box_bounds[0,0],
            box_bounds[1,1]-box_bounds[1,0],
            box_bounds[2,1]-box_bounds[2,0],
            max_neighbors
        )
        n = positions.shape[0]
        neigh = {i:[] for i in range(n)}
        for i in range(n):
            cand = pool[i]
            if len(cand) < num_neighbors:
                warnings.warn(
                    f"[HybridNeighborFinder] Atom {i}: only {len(cand)} "
                    f"candidates (<{num_neighbors}), using all available."
                )
                sel = cand.copy()
            else:
                # sort by squared distance
                d2 = [(j, np.sum((positions[j]-positions[i])**2)) for j in cand]
                d2.sort(key=lambda x: x[1])
                sel = [j for j,_ in d2[:num_neighbors]]
                neigh[i] = sel
        # symmetrize
        for i in range(n):
            for j in neigh[i]:
                if i not in neigh[j]:
                    neigh[j].append(i)
        return {i:sorted(neigh[i]) for i in range(n)}

    def find_neighbors(self):
        cn = HybridNeighborFinder.find_cutoff_neighbors(
            self.positions, self.box_bounds,
            self.cutoff, self.lx, self.ly, self.lz,
            self.max_neighbors
        )
        vn = HybridNeighborFinder.find_voronoi_neighbors(
            self.positions, self.box_bounds,
            self.num_neighbors, self.cutoff,
            self.voronoi_factor, self.max_neighbors
        )
        n = self.positions.shape[0]
        hybrid = {i:sorted(set(cn[i]).intersection(vn[i])) for i in range(n)}
        return hybrid
