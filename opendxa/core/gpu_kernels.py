from numba import cuda, types
from opendxa.utils.kernels import (
    spatial_hash_kernel,
    loop_detection_kernel,
    strain_field_kernel,
    mesh_refinement_kernel,
    loop_grouping_kernel
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
    
    def parallel_loop_grouping(self, loops, burgers_vectors, positions, spatial_threshold=5.0, burgers_threshold=0.1):
        if not loops:
            return np.array([])
            
        n_loops = len(loops)
        max_loop_length = max(len(loop) for loop in loops)
        
        # Pad loops to uniform length
        loop_array = np.full((n_loops, max_loop_length), -1, dtype=np.int32)
        loop_lengths = np.zeros(n_loops, dtype=np.int32)
        
        for i, loop in enumerate(loops):
            loop_lengths[i] = len(loop)
            loop_array[i, :len(loop)] = loop
        
        # GPU arrays
        d_loops = cuda.to_device(loop_array)
        d_loop_lengths = cuda.to_device(loop_lengths)
        d_burgers = cuda.to_device(burgers_vectors.astype(np.float32))
        d_positions = cuda.to_device(positions.astype(np.float32))
        d_group_assignments = cuda.device_array(n_loops, dtype=np.int32)
        d_group_count = cuda.device_array(1, dtype=np.int32)
        
        # Initialize
        d_group_assignments[:] = -1
        d_group_count[0] = 0
        
        # Launch kernel
        threads_per_block = 128
        blocks = (n_loops + threads_per_block - 1) // threads_per_block
        
        loop_grouping_kernel[blocks, threads_per_block](
            d_loops, d_loop_lengths, d_burgers, d_positions,
            spatial_threshold, burgers_threshold, d_group_assignments, d_group_count
        )
        
        group_assignments = d_group_assignments.copy_to_host()
        num_groups = d_group_count.copy_to_host()[0]
        
        self.logger.info(f"GPU loop grouping created {num_groups} groups")
        return group_assignments
    
    def adaptive_mesh_refinement(self, positions, connectivity, displacement_field, refinement_threshold=0.5):
        n_atoms = len(positions)
        max_neighbors = connectivity.shape[1]
        
        # GPU arrays
        d_positions = cuda.to_device(positions.astype(np.float32))
        d_connectivity = cuda.to_device(connectivity.astype(np.int32))
        d_displacement = cuda.to_device(displacement_field.astype(np.float32))
        d_refined_positions = cuda.device_array_like(d_positions)
        d_refinement_mask = cuda.device_array(n_atoms, dtype=np.int32)
        
        # Launch kernel
        threads_per_block = 256
        blocks = (n_atoms + threads_per_block - 1) // threads_per_block
        
        mesh_refinement_kernel[blocks, threads_per_block](
            d_positions, d_connectivity, max_neighbors, d_displacement,
            refinement_threshold, d_refined_positions, d_refinement_mask
        )
        
        refined_positions = d_refined_positions.copy_to_host()
        refinement_mask = d_refinement_mask.copy_to_host()
        
        num_refined = np.sum(refinement_mask)
        self.logger.info(f"GPU mesh refinement marked {num_refined} atoms for refinement")
        
        return refined_positions, refinement_mask
    
    def compute_strain_field(self, positions, connectivity, reference_positions, box_bounds):
        n_atoms = len(positions)
        max_neighbors = connectivity.shape[1]
        
        # GPU arrays
        d_positions = cuda.to_device(positions.astype(np.float32))
        d_connectivity = cuda.to_device(connectivity.astype(np.int32))
        d_reference = cuda.to_device(reference_positions.astype(np.float32))
        d_box_bounds = cuda.to_device(box_bounds.astype(np.float32))
        d_strain_tensor = cuda.device_array((n_atoms, 3, 3), dtype=np.float32)
        
        # Launch kernel
        threads_per_block = 256
        blocks = (n_atoms + threads_per_block - 1) // threads_per_block
        
        strain_field_kernel[blocks, threads_per_block](
            d_positions, d_connectivity, max_neighbors, d_reference,
            d_strain_tensor, d_box_bounds
        )
        
        strain_tensors = d_strain_tensor.copy_to_host()
        
        self.logger.info(f"GPU strain field computation completed for {n_atoms} atoms")
        return strain_tensors
