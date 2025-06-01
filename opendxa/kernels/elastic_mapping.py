from numba import cuda
import math

@cuda.jit
def gpu_elastic_mapping_kernel(
    displacement_jumps, 
    ideal_perfect_vectors, 
    ideal_partial_vectors, 
    tolerance,
    mapping_results,
    num_edges, 
    num_perfect, 
    num_partial
):
    edge_idx = cuda.grid(1)
    
    if edge_idx >= num_edges:
        return
    
    # Get displacement jump for this edge
    jump_x = displacement_jumps[edge_idx, 0]
    jump_y = displacement_jumps[edge_idx, 1]
    jump_z = displacement_jumps[edge_idx, 2]
    
    min_distance = math.inf
    # 0: unmapped, 1: perfect, 2: partial
    best_type = 0
    best_vector_idx = -1
    
    # Check perfect vectors
    for i in range(num_perfect):
        ideal_x = ideal_perfect_vectors[i, 0]
        ideal_y = ideal_perfect_vectors[i, 1]
        ideal_z = ideal_perfect_vectors[i, 2]
        
        dx = jump_x - ideal_x
        dy = jump_y - ideal_y
        dz = jump_z - ideal_z
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if distance < min_distance and distance < tolerance:
            min_distance = distance
            best_type = 1
            best_vector_idx = i
    
    # Check partial vectors
    for i in range(num_partial):
        ideal_x = ideal_partial_vectors[i, 0]
        ideal_y = ideal_partial_vectors[i, 1]
        ideal_z = ideal_partial_vectors[i, 2]
        
        dx = jump_x - ideal_x
        dy = jump_y - ideal_y
        dz = jump_z - ideal_z
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if distance < min_distance and distance < tolerance:
            min_distance = distance
            best_type = 2
            best_vector_idx = i
    
    mapping_results[edge_idx, 0] = best_type
    mapping_results[edge_idx, 1] = best_vector_idx
    mapping_results[edge_idx, 2] = min_distance