from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.utils.kernels import ptm_kernel
import numpy as np

def get_ptm_templates():
    # 1) Simple Cubic (SC): 6 neighbors
    sc = np.array([
        [ 1, 0, 0], [-1, 0, 0],
        [ 0, 1, 0], [ 0,-1, 0],
        [ 0, 0, 1], [ 0, 0,-1],
    ], dtype=np.float32)

    # 2) Body-Centered Cubic (BCC): 8 neighbors
    bcc = np.array([
        [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5],
        [ 0.5, -0.5,  0.5], [ 0.5,  0.5, -0.5],
        [-0.5, -0.5,  0.5], [-0.5,  0.5, -0.5],
        [ 0.5, -0.5, -0.5], [-0.5, -0.5, -0.5],
    ], dtype=np.float32)

    # 3) Face-Centered Cubic (FCC): 12 neighbors
    fcc = np.array([
        [ 0.0,  0.5,  0.5], [ 0.0,  0.5, -0.5],
        [ 0.0, -0.5,  0.5], [ 0.0, -0.5, -0.5],
        [ 0.5,  0.0,  0.5], [ 0.5,  0.0, -0.5],
        [-0.5,  0.0,  0.5], [-0.5,  0.0, -0.5],
        [ 0.5,  0.5,  0.0], [ 0.5, -0.5,  0.0],
        [-0.5,  0.5,  0.0], [-0.5, -0.5,  0.0],
    ], dtype=np.float32)

    # 4) Hexagonal Close-Packed (HCP): 12 neighbors
    #    We build a small HCP fragment and pick all points at distance ~1.0
    a = 1.0
    c = np.sqrt(8.0/3.0)
    a1 = np.array([1, 0, 0], dtype=np.float32)*a
    a2 = np.array([0.5, np.sqrt(3)/2, 0], dtype=np.float32)*a
    a3 = np.array([0, 0, c], dtype=np.float32)*a
    basis = [
        np.array([0.0, 0.0, 0.0], dtype=np.float32),
        np.array([2/3, 1/3, 1/2], dtype=np.float32),
    ]
    pts = []
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in (-1, 0, 1):
                for b in basis:
                    frac = b + np.array([i, j, k], dtype=np.float32)
                    P = frac[0]*a1 + frac[1]*a2 + frac[2]*a3
                    pts.append(P)
    pts = np.array(pts, dtype=np.float32)
    d2 = np.sum(pts**2, axis=1)
    mask = (d2 > 1e-6) & (d2 < (1.01)**2)
    hcp = np.unique(np.round(pts[mask], 5), axis=0)

    # 5) Icosahedral (ICO): 12 vertices of regular icosahedron
    phi = (1 + np.sqrt(5)) / 2
    ico = np.array([
        [ 0,  1,  phi], [ 0, -1,  phi],
        [ 0,  1, -phi], [ 0, -1, -phi],
        [ 1,  phi,  0], [-1,  phi,  0],
        [ 1, -phi,  0], [-1, -phi,  0],
        [ phi,  0,  1], [-phi,  0,  1],
        [ phi,  0, -1], [-phi,  0, -1],
    ], dtype=np.float32)
    # Normalize to neighbor distance ≈1.0
    ico /= np.linalg.norm(ico, axis=1)[:,None]

    # Collect and pad
    templates_list = [sc, bcc, fcc, hcp, ico]
    sizes = [t.shape[0] for t in templates_list]
    M = len(templates_list)
    Kmax = max(sizes)

    templates = np.zeros((M, Kmax, 3), dtype=np.float32)
    for idx, tpl in enumerate(templates_list):
        templates[idx, :tpl.shape[0], :] = tpl

    return templates, np.array(sizes, dtype=np.int32) 

class PTMLocalClassifier:
    def __init__(
        self, positions, box_bounds, neighbor_dict,
        templates, template_sizes, max_neighbors=32
    ):
        self.N = len(positions)
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        self.max_neighbors = max_neighbors

        # Prepare neighbor indices array
        self.neighbors = np.full((self.N, max_neighbors), -1, dtype=np.int32)
        for i, nbrs in neighbor_dict.items():
            for k, j in enumerate(nbrs[:max_neighbors]):
                self.neighbors[i,k] = j

        # Templates
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=np.int32)
        self.M = self.templates.shape[0]

    def classify(self):
        # Copy to device
        d_pos = cuda.to_device(self.positions)
        d_neigh = cuda.to_device(self.neighbors)
        d_box = cuda.to_device(self.box_bounds)
        d_templates = cuda.to_device(self.templates)
        d_tmpl_sz = cuda.to_device(self.template_sizes)
        # Output arrays
        d_types = cuda.device_array(self.N, dtype=np.int32)
        d_quat = cuda.device_array((self.N, 4), dtype=np.float32)
        # Launch kernel
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        ptm_kernel[blocks, threads_per_block](
            d_pos, d_neigh, d_box,
            d_templates, d_tmpl_sz, self.M,
            self.max_neighbors,
            d_types, d_quat
        )
        # Copy back
        types = d_types.copy_to_host()
        quats = d_quat.copy_to_host()
        return types, quats