from opendxa.utils.kernels import build_linked_list_kernel, cutoff_neighbors_kernel
from opendxa.utils.cuda import get_cuda_launch_config
from numba import cuda
import numpy as np
import warnings

def build_cell_list(positions, box_bounds, cutoff, lx, ly, lz):
    n = positions.shape[0]
    nx = max(1, int(lx // cutoff))
    ny = max(1, int(ly // cutoff))
    nz = max(1, int(lz // cutoff))
    dx = lx / nx
    dy = ly / ny
    dz = lz / nz

    cell_count = nx * ny * nz

    d_positions = cuda.to_device(positions)
    d_box_bounds = cuda.to_device(box_bounds)
    d_head = cuda.to_device(np.full(cell_count, -1, dtype=np.int64))
    d_linked = cuda.to_device(np.full(n, -1, dtype=np.int64))

    blocks, threads_per_block = get_cuda_launch_config(n)

    build_linked_list_kernel[blocks, threads_per_block](
        d_positions, d_box_bounds,
        nx, ny, nz, dx, dy, dz,
        d_head, d_linked
    )
    # cuda.synchronize()

    return d_head, d_linked, nx, ny, nz, dx, dy, dz

def cutoff_neighbors(
    # np.ndarray (n,3) float64
    positions,
    # np.ndarray (3,2) float64
    box_bounds,
    # float
    cutoff,
    # np.ndarray (ncells,) int64
    head,
    # np.ndarray (n,) int64
    linked,
    # int
    nx, ny, nz,
    # float
    dx, dy, dz,
    # float 
    lx, ly, lz,
    # int
    max_neighbors
):
    n = positions.shape[0]
    cutoff2 = cutoff * cutoff

    neigh_idx = -1 * np.ones((n, max_neighbors), dtype=np.int64)
    counts = np.zeros(n, dtype=np.int64)

    d_pos = cuda.to_device(positions)
    d_bounds = cuda.to_device(box_bounds)
    d_head = cuda.to_device(head)
    d_linked = cuda.to_device(linked)
    d_neigh = cuda.to_device(neigh_idx)
    d_counts = cuda.to_device(counts)

    blocks, blocks_per_thread = get_cuda_launch_config(n)

    cutoff_neighbors_kernel[blocks, blocks_per_thread](
        d_pos, d_bounds, cutoff2,
        d_head, d_linked,
        nx, ny, nz,
        dx, dy, dz,
        lx, ly, lz,
        max_neighbors,
        d_neigh, d_counts
    )
    cuda.synchronize()

    d_neigh.copy_to_host(neigh_idx)
    d_counts.copy_to_host(counts)

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
