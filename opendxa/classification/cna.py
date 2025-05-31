from numba import cuda
from opendxa.utils.kernels import cna_kernel, get_cuda_launch_config
import numpy as np

class CNALocalClassifier:
    def __init__(
        self,
        positions,
        box_bounds,
        neighbor_dict,
        cutoff_distance=3.5,
        max_neighbors=32
    ):
        self.N = len(positions)
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        self.max_neighbors = max_neighbors
        self.cutoff_distance = cutoff_distance

        # Prepare neighbor indices array
        self.neighbors = np.full((self.N, max_neighbors), -1, dtype=np.int32)
        for i, neighbors in neighbor_dict.items():
            for k, j in enumerate(neighbors[:max_neighbors]):
                self.neighbors[i, k] = j
    
    def classify(self):
        # Copy to device
        d_pos = cuda.to_device(self.positions)
        d_neigh = cuda.to_device(self.neighbors)
        d_box = cuda.to_device(self.box_bounds)

        # Output arrays
        d_types = cuda.device_array(self.N, dtype=np.int32)
        d_cna_signature = cuda.device_array((self.N, 3), dtype=np.int32)

        # Launch kernel
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        cna_kernel[blocks, threads_per_block](
            d_pos, d_neigh, d_box,
            self.cutoff_distance,
            self.max_neighbors,
            d_types, d_cna_signature
        )

        # Copy back
        types = d_types.copy_to_host()
        cna_signatures = d_cna_signature.copy_to_host()
        return types, cna_signatures