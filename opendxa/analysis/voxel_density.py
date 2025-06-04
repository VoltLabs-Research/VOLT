from collections import defaultdict
import numpy as np

def voxel_density(timesteps_data, grid_size=(10,10,10), box_bounds=None):
    nx, ny, nz = grid_size
    if box_bounds is None:
        box_bounds = [[0,1],[0,1],[0,1]]

    counts = defaultdict(int)
    for t, dislocs in timesteps_data.items():
        for d in dislocs:
            pts = np.array(d['points'])
            cen = np.mean(pts, axis=0)
            xi = int((cen[0] - box_bounds[0][0]) / (box_bounds[0][1]-box_bounds[0][0]) * nx)
            yi = int((cen[1] - box_bounds[1][0]) / (box_bounds[1][1]-box_bounds[1][0]) * ny)
            zi = int((cen[2] - box_bounds[2][0]) / (box_bounds[2][1]-box_bounds[2][0]) * nz)
            xi = min(max(xi, 0), nx-1)
            yi = min(max(yi, 0), ny-1)
            zi = min(max(zi, 0), nz-1)
            counts[(xi, yi, zi)] += 1
    return counts

def voxel_line_length_density(timesteps_data, grid_size=(10,10,10), box_bounds=None):
    nx, ny, nz = grid_size
    if box_bounds is None:
        box_bounds = [[0,1],[0,1],[0,1]]

    densities = np.zeros((nx, ny, nz), dtype=float)
    def voxel_index(pt):
        xi = int((pt[0] - box_bounds[0][0]) / (box_bounds[0][1]-box_bounds[0][0]) * nx)
        yi = int((pt[1] - box_bounds[1][0]) / (box_bounds[1][1]-box_bounds[1][0]) * ny)
        zi = int((pt[2] - box_bounds[2][0]) / (box_bounds[2][1]-box_bounds[2][0]) * nz)
        return min(max(xi,0),nx-1), min(max(yi,0),ny-1), min(max(zi,0),nz-1)

    for t, dislocs in timesteps_data.items():
        for d in dislocs:
            pts = np.array(d['points'])
            diffs = pts[1:] - pts[:-1]
            length = np.linalg.norm(diffs, axis=1).sum()
            cen = np.mean(pts, axis=0)
            i,j,k = voxel_index(cen)
            densities[i,j,k] += length

    return densities
