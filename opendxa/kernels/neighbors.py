from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
import numpy as np

@cuda.jit
def assign_and_find_neighbors_kernel(
    positions, box_bounds,
    cutoff2,
    nx, ny, nz, dx, dy, dz,
    lx, ly, lz,
    max_neighbors,
    head, linked,
    neigh_idx, counts
):
    i = cuda.grid(1)
    n = positions.shape[0]
    if i >= n:
        return

    xi = positions[i, 0]
    yi = positions[i, 1]
    zi = positions[i, 2]

    cx = int((xi - box_bounds[0,0]) / dx) % nx
    cy = int((yi - box_bounds[1,0]) / dy) % ny
    cz = int((zi - box_bounds[2,0]) / dz) % nz
    if cx < 0: cx += nx
    if cy < 0: cy += ny
    if cz < 0: cz += nz

    cell = cx + cy * nx + cz * nx * ny

    old = cuda.atomic.exch(head, cell, i)
    linked[i] = old

    cnt = 0
    for ox in (-1, 0, 1):
        ncx = (cx + ox + nx) % nx
        for oy in (-1, 0, 1):
            ncy = (cy + oy + ny) % ny
            for oz in (-1, 0, 1):
                ncz = (cz + oz + nz) % nz
                idx = ncx + ncy * nx + ncz * nx * ny
                j = head[idx]
                while j != -1:
                    if j > i:
                        xj = positions[j, 0]
                        yj = positions[j, 1]
                        zj = positions[j, 2]

                        dx_ = xj - xi
                        dy_ = yj - yi
                        dz_ = zj - zi
                        if dx_ > 0.5 * lx: dx_ -= lx
                        elif dx_ < -0.5 * lx: dx_ += lx
                        if dy_ > 0.5 * ly: dy_ -= ly
                        elif dy_ < -0.5 * ly: dy_ += ly
                        if dz_ > 0.5 * lz: dz_ -= lz
                        elif dz_ < -0.5 * lz: dz_ += lz

                        d2 = dx_ * dx_ + dy_ * dy_ + dz_ * dz_
                        if d2 <= cutoff2 and cnt < max_neighbors:
                            neigh_idx[i, cnt] = j
                            cnt += 1
                    j = linked[j]
    counts[i] = cnt

def find_neighbors_unified_kernel(
    positions, box_bounds, cutoff,
    lx, ly, lz,
    max_neighbors
):
    n = positions.shape[0]
    nx = max(1, int(lx // cutoff))
    ny = max(1, int(ly // cutoff))
    nz = max(1, int(lz // cutoff))
    dx = lx / nx
    dy = ly / ny
    dz = lz / nz
    cell_count = nx * ny * nz
    cutoff2 = cutoff * cutoff

    d_positions = cuda.to_device(positions)
    d_bounds = cuda.to_device(box_bounds)
    d_head = cuda.to_device(np.full(cell_count, -1, dtype=np.int64))
    d_linked = cuda.to_device(np.full(n, -1, dtype=np.int64))
    d_neigh = cuda.to_device(np.full((n, max_neighbors), -1, dtype=np.int64))
    d_counts = cuda.to_device(np.zeros(n, dtype=np.int64))

    blocks, threads_per_block = get_cuda_launch_config(n)
    assign_and_find_neighbors_kernel[blocks, threads_per_block](
        d_positions, d_bounds, cutoff2,
        nx, ny, nz, dx, dy, dz,
        lx, ly, lz, max_neighbors,
        d_head, d_linked,
        d_neigh, d_counts
    )
    neigh_idx = d_neigh.copy_to_host()
    counts = d_counts.copy_to_host()
    return neigh_idx, counts
