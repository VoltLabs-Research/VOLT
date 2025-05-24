from numba import cuda, types
from opendxa.utils.kernels import (
    spatial_hash_kernel,
    loop_detection_kernel
)
import logging
import numpy as np

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

    def parallel_loop_detection(self, connectivity, max_loop_length=100):
        """
        GPU-accelerated loop detection in connectivity graph.
        
        Args:
            connectivity: Neighbor connectivity matrix
            max_loop_length: Maximum allowed loop size
            
        Returns:
            Detected loops as list of atom indices
        """
        n_atoms = connectivity.shape[0]
        max_neighbors = connectivity.shape[1]
        
        # Estimate maximum possible loops
        max_loops = min(n_atoms * 10, 100000)  # Reasonable upper bound
        
        # GPU arrays
        d_connectivity = cuda.to_device(connectivity.astype(np.int32))
        d_visited = cuda.device_array(n_atoms, dtype=types.boolean)
        d_loop_buffer = cuda.device_array((max_loops, max_loop_length), dtype=np.int32)
        # +1 for counter
        d_loop_lengths = cuda.device_array(max_loops + 1, dtype=np.int32)
        
        # Initialize
        d_visited[:] = False
        d_loop_buffer[:] = -1
        d_loop_lengths[:] = 0
        
        # Launch kernel
        threads_per_block = 128
        blocks = (n_atoms + threads_per_block - 1) // threads_per_block
        
        loop_detection_kernel[blocks, threads_per_block](
            d_connectivity, max_neighbors, d_visited,
            d_loop_buffer, d_loop_lengths, max_loop_length, n_atoms
        )
        
        # Extract results
        loop_lengths = d_loop_lengths.copy_to_host()
        loop_buffer = d_loop_buffer.copy_to_host()
        
        num_loops = loop_lengths[0]
        loops = []
        
        for i in range(min(num_loops, max_loops)):
            length = loop_lengths[i + 1]
            if length > 0:
                loop = loop_buffer[i, :length].copy()
                loops.append(loop)
        
        self.logger.info(f"GPU loop detection found {len(loops)} loops")
        return loops
    