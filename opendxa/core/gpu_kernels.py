from numba import cuda
from opendxa.utils.kernels import spatial_hash_kernel
import logging

class GPUKernels:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    def spatial_hash_optimization(self, positions, box_bounds, grid_spacing=1.0):
        n_atoms = len(positions)
        
        # Calculate grid dimensions
        lx = box_bounds[0, 1] - box_bounds[0, 0]
        ly = box_bounds[1, 1] - box_bounds[1, 0]
        lz = box_bounds[2, 1] - box_bounds[2, 0]
        
        nx = max(1, int(lx / grid_spacing))
        ny = max(1, int(ly / grid_spacing))
        nz = max(1, int(lz / grid_spacing))
        
        n_cells = nx * ny * nz
        
        # GPU arrays
        d_positions = cuda.to_device(positions.astype(np.float32))
        d_box_bounds = cuda.to_device(box_bounds.astype(np.float32))
        d_atom_cells = cuda.device_array(n_atoms, dtype=np.int32)
        d_cell_counts = cuda.device_array(n_cells, dtype=np.int32)
        
        # Launch kernel
        threads_per_block = 256
        blocks = (n_atoms + threads_per_block - 1) // threads_per_block
        
        spatial_hash_kernel[blocks, threads_per_block](
            d_positions, d_box_bounds, grid_spacing,
            nx, ny, nz, None, d_atom_cells, d_cell_counts
        )
        
        return d_atom_cells.copy_to_host(), d_cell_counts.copy_to_host()
    