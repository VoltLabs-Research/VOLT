from numba import cuda, types
from opendxa.utils.kernels import (
    spatial_hash_kernel,
    loop_detection_kernel,
    strain_field_kernel,
    mesh_refinement_kernel,
    loop_grouping_kernel,
    gpu_compute_displacement_field_kernel_pbc,
    gpu_elastic_mapping_kernel
)

import logging
import numpy as np
import math

class GPUKernels:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.device = cuda.get_current_device()

    def elastic_mapping_gpu(self, displacement_jumps, ideal_vectors, tolerance):
        num_edges = len(displacement_jumps)
        
        # Prepare data
        jump_array = np.array(list(displacement_jumps.values()), dtype=np.float32)
        perfect_vectors = ideal_vectors['perfect'].astype(np.float32)
        partial_vectors = ideal_vectors.get('partial', np.array([])).astype(np.float32)
        
        # Transfer to GPU
        d_jumps = cuda.to_device(jump_array)
        d_perfect = cuda.to_device(perfect_vectors)
        d_partial = cuda.to_device(partial_vectors)
        d_results = cuda.device_array((num_edges, 3), dtype=np.float32)
        
        # Launch kernel
        threads_per_block = 256
        blocks = math.ceil(num_edges / threads_per_block)
        
        gpu_elastic_mapping_kernel[blocks, threads_per_block](
            None, d_jumps, d_perfect, d_partial, tolerance, d_results,
            num_edges, len(perfect_vectors), len(partial_vectors)
        )
        
        # Copy result back
        results = d_results.copy_to_host()
        
        # Process results
        mapping_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0}
        edge_burgers = {}
        
        for i, (edge, jump) in enumerate(displacement_jumps.items()):
            mapping_type = int(results[i, 0])
            vector_idx = int(results[i, 1])
            
            if mapping_type == 1:  # perfect
                edge_burgers[edge] = perfect_vectors[vector_idx]
                mapping_stats['perfect'] += 1
            elif mapping_type == 2:  # partial
                edge_burgers[edge] = partial_vectors[vector_idx]
                mapping_stats['partial'] += 1
            else:  # unmapped
                edge_burgers[edge] = jump
                mapping_stats['unmapped'] += 1
        
        return edge_burgers, mapping_stats
    
    def compute_displacement_field_gpu(self, positions, connectivity, ptm_types, templates):
        num_atoms = len(positions)
        
        # Prepare connectivity data in CSR format
        connectivity_data = []
        connectivity_offsets = [0]
        
        for atom_id in range(num_atoms):
            neighbors = connectivity.get(atom_id, [])
            connectivity_data.extend(neighbors)
            connectivity_offsets.append(len(connectivity_data))
        
        # Prepare arrays
        positions_array = positions.astype(np.float32)
        quaternions_array = np.zeros((num_atoms, 4), dtype=np.float32)
        # Default to identity quaternion
        quaternions_array[:, 0] = 1.0
        
        # Get template data (if available)
        if templates is not None and hasattr(templates, 'shape'):
            templates_array = templates.astype(np.float32)
            template_sizes = np.array([templates.shape[1]] * templates.shape[0], dtype=np.int32)
        else:
            # Use FCC default template
            fcc_template = np.array([
                [0.5, 0.5, 0.0], [0.5, -0.5, 0.0], [0.5, 0.0, 0.5], [0.5, 0.0, -0.5],
                [0.0, 0.5, 0.5], [0.0, 0.5, -0.5], [-0.5, 0.5, 0.0], [-0.5, -0.5, 0.0],
                [-0.5, 0.0, 0.5], [-0.5, 0.0, -0.5], [0.0, -0.5, 0.5], [0.0, -0.5, -0.5]
            ], dtype=np.float32)
            templates_array = fcc_template.reshape(1, 12, 3)
            template_sizes = np.array([12], dtype=np.int32)
        
        # Default box bounds and PBC
        box_bounds = np.array([
            [positions[:, 0].min() - 1, positions[:, 0].max() + 1],
            [positions[:, 1].min() - 1, positions[:, 1].max() + 1],
            [positions[:, 2].min() - 1, positions[:, 2].max() + 1]
        ], dtype=np.float32)
        pbc_flags = np.array([True, True, True], dtype=bool)
        
        # Transfer to GPU
        d_positions = cuda.to_device(positions_array)
        d_connectivity_data = cuda.to_device(np.array(connectivity_data, dtype=np.int32))
        d_connectivity_offsets = cuda.to_device(np.array(connectivity_offsets, dtype=np.int32))
        d_ptm_types = cuda.to_device(ptm_types.astype(np.int32))
        d_quaternions = cuda.to_device(quaternions_array)
        d_templates = cuda.to_device(templates_array)
        d_template_sizes = cuda.to_device(template_sizes)
        d_box_bounds = cuda.to_device(box_bounds)
        d_pbc_flags = cuda.to_device(pbc_flags)
        
        # Output array
        d_displacement_vectors = cuda.device_array((num_atoms, 3), dtype=np.float32)
        
        # Launch kernel
        threads_per_block = 256
        blocks = math.ceil(num_atoms / threads_per_block)
        
        gpu_compute_displacement_field_kernel_pbc[blocks, threads_per_block](
            d_positions, d_connectivity_data, d_connectivity_offsets,
            d_ptm_types, d_quaternions, d_templates, d_template_sizes,
            d_box_bounds, d_pbc_flags, d_displacement_vectors,
            num_atoms, 64
        )
        
        # Copy result back
        displacement_vectors = d_displacement_vectors.copy_to_host()
        
        # Convert to dictionary format
        result = {}
        for i in range(num_atoms):
            if not np.isnan(displacement_vectors[i]).any():
                result[i] = displacement_vectors[i]
        
        return result

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
