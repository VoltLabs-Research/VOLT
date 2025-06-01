from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.kernels.ptm import ptm_kernel
import numpy as np

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