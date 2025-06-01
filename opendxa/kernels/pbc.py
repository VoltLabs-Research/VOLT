from numba import cuda
import math

@cuda.jit
def gpu_compute_displacement_field_kernel_pbc(
    positions, 
    connectivity_data, 
    connectivity_offsets,
    ptm_types, 
    quaternions, 
    templates, 
    template_sizes,
    box_bounds, 
    pbc_flags, 
    displacement_vectors, 
    num_atoms,
):
    atom_idx = cuda.grid(1)
    
    if atom_idx >= num_atoms:
        return
    
    ptm_type = ptm_types[atom_idx]
    if ptm_type < 0 or ptm_type >= template_sizes.shape[0]:
        displacement_vectors[atom_idx, 0] = math.nan
        displacement_vectors[atom_idx, 1] = math.nan
        displacement_vectors[atom_idx, 2] = math.nan
        return
    
    start_idx = connectivity_offsets[atom_idx]
    end_idx = connectivity_offsets[atom_idx + 1]
    num_neighbors = end_idx - start_idx

    # Need minimum connectivity    
    if num_neighbors < 6:
        displacement_vectors[atom_idx, 0] = math.nan
        displacement_vectors[atom_idx, 1] = math.nan
        displacement_vectors[atom_idx, 2] = math.nan
        return
    
    # Get atom position and rotation matrix from quaternion
    xi = positions[atom_idx, 0]
    yi = positions[atom_idx, 1]
    zi = positions[atom_idx, 2]
    qw = quaternions[atom_idx, 0]
    qx = quaternions[atom_idx, 1]
    qy = quaternions[atom_idx, 2]
    qz = quaternions[atom_idx, 3]
    
    # Convert quaternion to rotation matrix
    R00 = 1 - 2 * (qy * qy + qz * qz)
    R01 = 2 * (qx * qy - qz * qw)
    R02 = 2 * (qx * qz + qy * qw)
    R10 = 2 * (qx * qy + qz * qw)
    R11 = 1 - 2 * (qx * qx + qz * qz)
    R12 = 2 * (qy * qz - qx * qw)
    R20 = 2 * (qx * qz - qy * qw)
    R21 = 2 * (qy * qz + qx * qw)
    R22 = 1 - 2 * (qx * qx + qy * qy)
    
    # Compute local scale from actual bond lengths
    avg_bond_length = 0.0
    valid_bonds = 0
    
    # Use first 12 neighbors    
    for i in range(start_idx, min(end_idx, start_idx + 12)):
        neighbor_idx = connectivity_data[i]
        if neighbor_idx < num_atoms:
            # Compute PBC-aware distance
            dx = positions[neighbor_idx, 0] - xi
            dy = positions[neighbor_idx, 1] - yi
            dz = positions[neighbor_idx, 2] - zi
            
            # Apply PBC
            if pbc_flags[0]:
                box_x = box_bounds[0, 1] - box_bounds[0, 0]
                if dx > box_x * 0.5:
                    dx -= box_x
                elif dx < -box_x * 0.5:
                    dx += box_x
            
            if pbc_flags[1]:
                box_y = box_bounds[1, 1] - box_bounds[1, 0]
                if dy > box_y * 0.5:
                    dy -= box_y
                elif dy < -box_y * 0.5:
                    dy += box_y
                    
            if pbc_flags[2]:
                box_z = box_bounds[2, 1] - box_bounds[2, 0]
                if dz > box_z * 0.5:
                    dz -= box_z
                elif dz < -box_z * 0.5:
                    dz += box_z
            
            bond_length = math.sqrt(dx*dx + dy*dy + dz*dz)
            avg_bond_length += bond_length
            valid_bonds += 1
    
    if valid_bonds == 0:
        displacement_vectors[atom_idx, 0] = math.nan
        displacement_vectors[atom_idx, 1] = math.nan
        displacement_vectors[atom_idx, 2] = math.nan
        return
    
    scale = avg_bond_length / valid_bonds
    
    # Get template size and compute ideal positions
    template_size = template_sizes[ptm_type]
    cumulative_displacement_x = 0.0
    cumulative_displacement_y = 0.0
    cumulative_displacement_z = 0.0
    matched_neighbors = 0
    
    # Limit template points
    for t_idx in range(min(template_size, 12)):
        # Get template point in global coordinates
        tx = templates[ptm_type, t_idx, 0]
        ty = templates[ptm_type, t_idx, 1]
        tz = templates[ptm_type, t_idx, 2]
        
        # Rotate template point and scale
        ideal_x = (R00 * tx + R01 * ty + R02 * tz) * scale + xi
        ideal_y = (R10 * tx + R11 * ty + R12 * tz) * scale + yi
        ideal_z = (R20 * tx + R21 * ty + R22 * tz) * scale + zi
        
        # Find closest real neighbor to this ideal position
        min_dist_sq = math.inf
        best_neighbor_idx = -1
        
        for i in range(start_idx, end_idx):
            neighbor_idx = connectivity_data[i]
            if neighbor_idx < num_atoms:
                nx, ny, nz = positions[neighbor_idx, 0], positions[neighbor_idx, 1], positions[neighbor_idx, 2]
                
                # Apply PBC to neighbor-ideal distance
                dx = nx - ideal_x
                dy = ny - ideal_y
                dz = nz - ideal_z
                
                if pbc_flags[0]:
                    box_x = box_bounds[0, 1] - box_bounds[0, 0]
                    if dx > box_x * 0.5:
                        dx -= box_x
                    elif dx < -box_x * 0.5:
                        dx += box_x
                
                if pbc_flags[1]:
                    box_y = box_bounds[1, 1] - box_bounds[1, 0]
                    if dy > box_y * 0.5:
                        dy -= box_y
                    elif dy < -box_y * 0.5:
                        dy += box_y
                        
                if pbc_flags[2]:
                    box_z = box_bounds[2, 1] - box_bounds[2, 0]
                    if dz > box_z * 0.5:
                        dz -= box_z
                    elif dz < -box_z * 0.5:
                        dz += box_z
                
                dist_sq = dx*dx + dy*dy + dz*dz
                if dist_sq < min_dist_sq:
                    min_dist_sq = dist_sq
                    best_neighbor_idx = neighbor_idx
        
        # If we found a match, compute displacement
        if best_neighbor_idx >= 0:
            real_x = positions[best_neighbor_idx, 0]
            real_y = positions[best_neighbor_idx, 1]
            real_z = positions[best_neighbor_idx, 2]
            
            # Displacement = real - ideal (with PBC correction)
            disp_x = real_x - ideal_x
            disp_y = real_y - ideal_y
            disp_z = real_z - ideal_z
            
            # Apply PBC to displacement
            if pbc_flags[0]:
                box_x = box_bounds[0, 1] - box_bounds[0, 0]
                if disp_x > box_x * 0.5:
                    disp_x -= box_x
                elif disp_x < -box_x * 0.5:
                    disp_x += box_x
            
            if pbc_flags[1]:
                box_y = box_bounds[1, 1] - box_bounds[1, 0]
                if disp_y > box_y * 0.5:
                    disp_y -= box_y
                elif disp_y < -box_y * 0.5:
                    disp_y += box_y
                    
            if pbc_flags[2]:
                box_z = box_bounds[2, 1] - box_bounds[2, 0]
                if disp_z > box_z * 0.5:
                    disp_z -= box_z
                elif disp_z < -box_z * 0.5:
                    disp_z += box_z
            
            cumulative_displacement_x += disp_x
            cumulative_displacement_y += disp_y
            cumulative_displacement_z += disp_z
            matched_neighbors += 1
    
    # Average displacement
    if matched_neighbors > 0:
        displacement_vectors[atom_idx, 0] = cumulative_displacement_x / matched_neighbors
        displacement_vectors[atom_idx, 1] = cumulative_displacement_y / matched_neighbors
        displacement_vectors[atom_idx, 2] = cumulative_displacement_z / matched_neighbors
    else:
        displacement_vectors[atom_idx, 0] = math.nan
        displacement_vectors[atom_idx, 1] = math.nan
        displacement_vectors[atom_idx, 2] = math.nan

@cuda.jit
def gpu_pbc_distance_kernel(pos1, pos2, box_bounds, pbc_flags, distances, num_pairs):
    pair_idx = cuda.grid(1)
    
    if pair_idx >= num_pairs:
        return
    
    # Get positions
    x1 = pos1[pair_idx, 0]
    y1 = pos1[pair_idx, 1]
    z1 = pos1[pair_idx, 2]
    x2 = pos2[pair_idx, 0]
    y2 = pos2[pair_idx, 1]
    z2 = pos2[pair_idx, 2]
    
    # Compute raw differences
    dx = x2 - x1
    dy = y2 - y1
    dz = z2 - z1
    
    # Apply PBC corrections
    # X direction
    if pbc_flags[0]:
        box_x = box_bounds[0, 1] - box_bounds[0, 0]
        if dx > box_x * 0.5:
            dx -= box_x
        elif dx < -box_x * 0.5:
            dx += box_x

    # Y direction    
    if pbc_flags[1]: 
        box_y = box_bounds[1, 1] - box_bounds[1, 0]
        if dy > box_y * 0.5:
            dy -= box_y
        elif dy < -box_y * 0.5:
            dy += box_y
    
    # Z direction
    if pbc_flags[2]:
        box_z = box_bounds[2, 1] - box_bounds[2, 0]
        if dz > box_z * 0.5:
            dz -= box_z
        elif dz < -box_z * 0.5:
            dz += box_z
    
    # Compute distance
    distances[pair_idx] = math.sqrt(dx * dx + dy * dy + dz * dz)