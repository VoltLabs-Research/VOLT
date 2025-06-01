from numba import cuda
from opendxa.kernels.pbc import gpu_compute_displacement_field_kernel_pbc
from opendxa.kernels.elastic_mapping import gpu_elastic_mapping_kernel
import numpy as np
import math

def get_cuda_launch_config(items, threads_per_block=256, min_blocks_per_sm=16):
    device = cuda.get_current_device()
    sms = device.MULTIPROCESSOR_COUNT
    min_blocks = sms * min_blocks_per_sm
    data_blocks = math.ceil(items / threads_per_block)
    blocks = max(min_blocks, data_blocks)
    return blocks, threads_per_block

def elastic_mapping_gpu(displacement_jumps, ideal_vectors, tolerance):
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
        d_jumps, 
        d_perfect, 
        d_partial, 
        tolerance, 
        d_results,
        num_edges, 
        len(perfect_vectors), 
        len(partial_vectors)
    )
    
    # Copy result back
    results = d_results.copy_to_host()
    
    # Process results
    mapping_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0}
    edge_burgers = {}
    
    for i, (edge, jump) in enumerate(displacement_jumps.items()):
        mapping_type = int(results[i, 0])
        vector_idx = int(results[i, 1])
        
        if mapping_type == 1: 
            # perfect
            edge_burgers[edge] = perfect_vectors[vector_idx]
            mapping_stats['perfect'] += 1
        elif mapping_type == 2:
            # partial
            edge_burgers[edge] = partial_vectors[vector_idx]
            mapping_stats['partial'] += 1
        else:
            # unmapped
            edge_burgers[edge] = jump
            mapping_stats['unmapped'] += 1
    
    return edge_burgers, mapping_stats

def compute_displacement_field_gpu(positions, connectivity, ptm_types, templates):
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
        d_positions, 
        d_connectivity_data, 
        d_connectivity_offsets,
        d_ptm_types, 
        d_quaternions, 
        d_templates, 
        d_template_sizes,
        d_box_bounds, 
        d_pbc_flags, 
        d_displacement_vectors,
        num_atoms
    )
    
    # Copy result back
    displacement_vectors = d_displacement_vectors.copy_to_host()
    
    # Convert to dictionary format
    result = {}
    for i in range(num_atoms):
        if not np.isnan(displacement_vectors[i]).any():
            result[i] = displacement_vectors[i]
    
    return result

def quaternion_to_matrix(quaternion):
    w, x, y, z = quaternion
    ww = w * w
    xx = x * x
    yy = y * y
    zz = z * z
    wx = w * x
    wy = w * y
    wz = w * z
    xy = x * y
    xz = x * z
    yz = y * z

    R = np.array([
        [ww + xx - yy - zz, 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), ww - xx + yy - zz, 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), ww - xx - yy + zz]
    ], dtype=np.float32)
    
    return R