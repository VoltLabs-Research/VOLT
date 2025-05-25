from numba import cuda, float32, int32, types
from opendxa.utils.cuda import get_cuda_launch_config
import numpy as np
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
    qw = quaternions[atom_idx, 0], 
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
def loop_grouping_kernel(
    loops,
    loop_lengths,
    burgers_vectors,
    positions,
    spatial_threshold,
    burgers_threshold,
    group_assignments,
    group_count
):
    loop_id = cuda.grid(1)
    if loop_id >= loops.shape[0]:
        return
    
    loop_len = loop_lengths[loop_id]
    if loop_len <= 0:
        return
    
    # Compute loop centroid
    cx = cy = cz = 0.0
    for i in range(loop_len):
        atom_id = loops[loop_id, i]
        cx += positions[atom_id, 0]
        cy += positions[atom_id, 1] 
        cz += positions[atom_id, 2]
    
    cx /= loop_len
    cy /= loop_len
    cz /= loop_len
    
    # Get this loop's Burgers vector
    bx = burgers_vectors[loop_id, 0]
    by = burgers_vectors[loop_id, 1]
    bz = burgers_vectors[loop_id, 2]
    b_mag = (bx*bx + by*by + bz*bz)**0.5
    
    # Find best group or create new one
    best_group = -1
    min_distance = float('inf')
    
    # Check against other loops
    for other_loop in range(loops.shape[0]):
        if other_loop == loop_id or loop_lengths[other_loop] <= 0:
            continue
            
        # Compute other loop centroid
        other_len = loop_lengths[other_loop]
        ox = oy = oz = 0.0
        for i in range(other_len):
            atom_id = loops[other_loop, i]
            ox += positions[atom_id, 0]
            oy += positions[atom_id, 1]
            oz += positions[atom_id, 2]
        
        ox /= other_len
        oy /= other_len
        oz /= other_len
        
        # Spatial distance
        dx = cx - ox
        dy = cy - oy
        dz = cz - oz
        spatial_dist = (dx*dx + dy*dy + dz*dz)**0.5
        
        if spatial_dist > spatial_threshold:
            continue
            
        # Burgers vector similarity
        obx = burgers_vectors[other_loop, 0]
        oby = burgers_vectors[other_loop, 1]
        obz = burgers_vectors[other_loop, 2]
        ob_mag = (obx*obx + oby*oby + obz*obz)**0.5
        
        if b_mag > 0 and ob_mag > 0:
            # Compute angle between Burgers vectors
            dot_product = (bx*obx + by*oby + bz*obz) / (b_mag * ob_mag)
            dot_product = max(-1.0, min(1.0, dot_product))
            angle = cuda.libdevice.acos(abs(dot_product))
            
            if angle <= burgers_threshold:
                # Found compatible loop
                if spatial_dist < min_distance:
                    min_distance = spatial_dist
                    best_group = group_assignments[other_loop]
    
    # Assign to best group or create new group
    if best_group >= 0:
        group_assignments[loop_id] = best_group
    else:
        # Create new group
        new_group = cuda.atomic.add(group_count, 0, 1)
        group_assignments[loop_id] = new_group

@cuda.jit
def mesh_refinement_kernel(
    positions,
    connectivity,
    max_neighbors,
    displacement_field,
    refinement_threshold,
    refined_positions,
    refinement_mask
):
    atom_id = cuda.grid(1)
    if atom_id >= positions.shape[0]:
        return
    
    # Calculate local displacement gradient magnitude
    gradient_mag = 0.0
    neighbor_count = 0
    
    # Get displacement for current atom
    disp_x = displacement_field[atom_id, 0]
    disp_y = displacement_field[atom_id, 1]
    disp_z = displacement_field[atom_id, 2]
    
    # Compare with neighbors
    for n_idx in range(max_neighbors):
        neighbor = connectivity[atom_id, n_idx]
        if neighbor < 0:
            break
            
        # Neighbor displacement
        ndisp_x = displacement_field[neighbor, 0]
        ndisp_y = displacement_field[neighbor, 1]
        ndisp_z = displacement_field[neighbor, 2]
        
        # Gradient contribution
        gdx = abs(disp_x - ndisp_x)
        gdy = abs(disp_y - ndisp_y)
        gdz = abs(disp_z - ndisp_z)
        
        gradient_mag += (gdx*gdx + gdy*gdy + gdz*gdz)**0.5
        neighbor_count += 1
    
    if neighbor_count > 0:
        gradient_mag /= neighbor_count
    
    # Mark for refinement if gradient exceeds threshold
    if gradient_mag > refinement_threshold:
        refinement_mask[atom_id] = 1
        
        # Store refined position (could be interpolated)
        refined_positions[atom_id, 0] = positions[atom_id, 0]
        refined_positions[atom_id, 1] = positions[atom_id, 1]
        refined_positions[atom_id, 2] = positions[atom_id, 2]
    else:
        refinement_mask[atom_id] = 0


@cuda.jit
def dislocation_threading_kernel(
    loop_groups,
    group_sizes,
    loop_positions,
    threading_result,
    max_groups
):
    group_id = cuda.grid(1)
    if group_id >= max_groups or group_sizes[group_id] <= 1:
        return
    
    # Process loops in this group
    group_size = group_sizes[group_id]
    
    # Simple nearest-neighbor threading for now
    # More sophisticated algorithms can be implemented
    visited = cuda.local.array(64, types.boolean)  # Assume max 64 loops per group
    for i in range(64):
        visited[i] = False
    
    if group_size > 64:
        return  # Safety check
    
    # Start with first loop in group
    current_loop = 0
    threading_result[group_id, 0] = loop_groups[group_id, 0]
    visited[0] = True
    thread_length = 1
    
    # Thread remaining loops
    for step in range(group_size - 1):
        best_next = -1
        min_distance = float('inf')
        
        current_pos_x = loop_positions[loop_groups[group_id, current_loop], 0]
        current_pos_y = loop_positions[loop_groups[group_id, current_loop], 1]
        current_pos_z = loop_positions[loop_groups[group_id, current_loop], 2]
        
        # Find closest unvisited loop
        for candidate in range(group_size):
            if visited[candidate]:
                continue
                
            candidate_loop = loop_groups[group_id, candidate]
            dx = loop_positions[candidate_loop, 0] - current_pos_x
            dy = loop_positions[candidate_loop, 1] - current_pos_y
            dz = loop_positions[candidate_loop, 2] - current_pos_z
            
            distance = (dx*dx + dy*dy + dz*dz)**0.5
            
            if distance < min_distance:
                min_distance = distance
                best_next = candidate
        
        if best_next >= 0:
            threading_result[group_id, thread_length] = loop_groups[group_id, best_next]
            visited[best_next] = True
            current_loop = best_next
            thread_length += 1


@cuda.jit
def strain_field_kernel(
    positions,
    connectivity,
    max_neighbors,
    reference_positions,
    strain_tensor,
    box_bounds
):
    atom_id = cuda.grid(1)
    if atom_id >= positions.shape[0]:
        return
    
    # Initialize local strain tensor
    strain = cuda.local.array((3, 3), float32)
    for i in range(3):
        for j in range(3):
            strain[i, j] = 0.0
    
    # Reference and current positions
    ref_pos = cuda.local.array(3, float32)
    curr_pos = cuda.local.array(3, float32)
    
    ref_pos[0] = reference_positions[atom_id, 0]
    ref_pos[1] = reference_positions[atom_id, 1]
    ref_pos[2] = reference_positions[atom_id, 2]
    
    curr_pos[0] = positions[atom_id, 0]
    curr_pos[1] = positions[atom_id, 1]
    curr_pos[2] = positions[atom_id, 2]
    
    # Process neighbors to compute strain
    neighbor_count = 0
    for n_idx in range(max_neighbors):
        neighbor = connectivity[atom_id, n_idx]
        if neighbor < 0:
            break
        
        # Reference bond vector
        ref_dx = reference_positions[neighbor, 0] - ref_pos[0]
        ref_dy = reference_positions[neighbor, 1] - ref_pos[1]
        ref_dz = reference_positions[neighbor, 2] - ref_pos[2]
        
        # Current bond vector  
        curr_dx = positions[neighbor, 0] - curr_pos[0]
        curr_dy = positions[neighbor, 1] - curr_pos[1]
        curr_dz = positions[neighbor, 2] - curr_pos[2]
        
        # Apply PBC if needed
        if box_bounds.shape[0] >= 3:
            lx = box_bounds[0, 1] - box_bounds[0, 0]
            ly = box_bounds[1, 1] - box_bounds[1, 0]
            lz = box_bounds[2, 1] - box_bounds[2, 0]
            
            # PBC correction for current positions
            if curr_dx > 0.5 * lx: curr_dx -= lx
            elif curr_dx < -0.5 * lx: curr_dx += lx
            if curr_dy > 0.5 * ly: curr_dy -= ly  
            elif curr_dy < -0.5 * ly: curr_dy += ly
            if curr_dz > 0.5 * lz: curr_dz -= lz
            elif curr_dz < -0.5 * lz: curr_dz += lz
            
            # PBC correction for reference positions
            if ref_dx > 0.5 * lx: ref_dx -= lx
            elif ref_dx < -0.5 * lx: ref_dx += lx
            if ref_dy > 0.5 * ly: ref_dy -= ly
            elif ref_dy < -0.5 * ly: ref_dy += ly  
            if ref_dz > 0.5 * lz: ref_dz -= lz
            elif ref_dz < -0.5 * lz: ref_dz += lz
        
        # Contribution to strain tensor (simplified Green-Lagrange strain)
        # ε_ij = 0.5 * (∂u_i/∂x_j + ∂u_j/∂x_i)
        # Displacement u = current - reference
        u_x = curr_dx - ref_dx
        u_y = curr_dy - ref_dy
        u_z = curr_dz - ref_dz
        
        # Approximate gradients using finite differences
        if abs(ref_dx) > 1e-6:
            strain[0, 0] += u_x / ref_dx
            strain[1, 0] += u_y / ref_dx
            strain[2, 0] += u_z / ref_dx
        if abs(ref_dy) > 1e-6:
            strain[0, 1] += u_x / ref_dy
            strain[1, 1] += u_y / ref_dy  
            strain[2, 1] += u_z / ref_dy
        if abs(ref_dz) > 1e-6:
            strain[0, 2] += u_x / ref_dz
            strain[1, 2] += u_y / ref_dz
            strain[2, 2] += u_z / ref_dz
        
        neighbor_count += 1
    
    # Average and symmetrize strain tensor
    if neighbor_count > 0:
        inv_count = 1.0 / neighbor_count
        for i in range(3):
            for j in range(3):
                strain[i, j] *= inv_count
                # Symmetrize: ε_ij = 0.5 * (ε_ij + ε_ji)
                if i != j:
                    avg_strain = 0.5 * (strain[i, j] + strain[j, i])
                    strain_tensor[atom_id, i, j] = avg_strain
                    strain_tensor[atom_id, j, i] = avg_strain
                else:
                    strain_tensor[atom_id, i, j] = strain[i, j]

@cuda.jit
def loop_detection_kernel(
    connectivity,
    max_neighbors,
    visited,
    loop_buffer,
    loop_lengths,
    max_loop_length,
    atom_count
):
    start_atom = cuda.grid(1)
    if start_atom >= atom_count:
        return
    
    # Local stack for DFS
    stack = cuda.local.array(256, int32)
    # Current path
    path = cuda.local.array(256, int32)
    stack_size = 0
    path_size = 0
    
    # Initialize with starting atom
    if not visited[start_atom]:
        stack[stack_size] = start_atom
        stack_size += 1
        path[path_size] = start_atom
        path_size += 1
        visited[start_atom] = True
        
        while stack_size > 0:
            # Pop from stack
            stack_size -= 1
            current = stack[stack_size]
            
            # Check neighbors
            for neighbor_idx in range(max_neighbors):
                neighbor = connectivity[current, neighbor_idx]
                if neighbor < 0:  # End of neighbor list
                    break
                
                # Found loop closure
                if neighbor == start_atom and path_size >= 3:
                    # Store loop if within size limits
                    if path_size <= max_loop_length:
                        # Get next loop slot
                        loop_id = cuda.atomic.add(loop_lengths, 0, 1)
                        if loop_id < loop_buffer.shape[0]:
                            for i in range(path_size):
                                loop_buffer[loop_id, i] = path[i]
                            # Store actual length
                            loop_lengths[loop_id + 1] = path_size
                    break
                    
                # Continue DFS if not visited and path not too long
                elif not visited[neighbor] and path_size < max_loop_length:
                    visited[neighbor] = True
                    stack[stack_size] = neighbor
                    stack_size += 1
                    path[path_size] = neighbor
                    path_size += 1
                    
                    # Stack overflow protection
                    if stack_size >= 256 or path_size >= 256:
                        break
            
            # Backtrack if we've explored all neighbors
            if stack_size == 0 or (stack_size > 0 and stack[stack_size - 1] != current):
                if path_size > 0:
                    path_size -= 1
                    if path_size > 0:
                        visited[path[path_size]] = False

@cuda.jit
def spatial_hash_kernel(
    positions,
    box_bounds,
    grid_spacing,
    nx,
    ny,
    nz,
    atom_cells,
    cell_counts
):
    i = cuda.grid(1)
    if i >= positions.shape[0]:
        return
    
    # Get box dimensions
    lx = box_bounds[0, 1] - box_bounds[0, 0]
    ly = box_bounds[1, 1] - box_bounds[1, 0] 
    lz = box_bounds[2, 1] - box_bounds[2, 0]
    
    # Compute grid cell indices
    x = positions[i, 0] - box_bounds[0, 0]
    y = positions[i, 1] - box_bounds[1, 0]
    z = positions[i, 2] - box_bounds[2, 0]
    
    # Handle PBC wrapping
    x = x - lx * cuda.libdevice.floor(x / lx)
    y = y - ly * cuda.libdevice.floor(y / ly)
    z = z - lz * cuda.libdevice.floor(z / lz)
    
    # Grid indices
    ix = int(x / grid_spacing)
    iy = int(y / grid_spacing)
    iz = int(z / grid_spacing)
    
    # Ensure within bounds
    ix = max(0, min(ix, nx - 1))
    iy = max(0, min(iy, ny - 1))
    iz = max(0, min(iz, nz - 1))
    
    # Linear cell index
    cell_id = ix + iy * nx + iz * nx * ny
    
    # Store atom->cell mapping
    atom_cells[i] = cell_id
    
    # Atomically increment cell count
    cuda.atomic.add(cell_counts, cell_id, 1)

@cuda.jit
def ptm_kernel(
    positions,
    neighbors,
    box_bounds,
    templates,
    template_sizes,
    M,
    max_neighbors,
    out_types,
    out_quaternion
):
    '''
    For each atom i:
    - Gather neighbor positions into local array P[K_i][3]
    - For each template t in 0 .. M - 1:
        - Get template neighbor coords T[K_t][3]
        - Compute centroids cP, cT
        - Compute covariance H = sum_j (P_j - cP) (T_j - cT) ^ T
        - Build 4x4 K matrix from H
        - Compute principal eigenvector (quaternion) via power iteration
        - Rotate T by quaternion and compute RMSD with P
    - Pick t with minimal RMSD, write out_types[i] = t, out_quaternion[i] = quaternion
    '''
    i = cuda.grid(1)
    if i >= positions.shape[0]:
        return
    
    # Shared local arrays
    P = cuda.local.array((64, 3), float32)
    T = cuda.local.array((64,3), float32)
    cP = cuda.local.array(3, float32)
    cT = cuda.local.array(3, float32)

    # Load atom position
    xi = positions[i, 0]
    yi = positions[i, 1]
    zi = positions[i, 2]

    # Gather neighbors
    Ni = 0
    for k in range(0, max_neighbors):
        j = neighbors[i, k]
        if j < 0:
            break

        # Displacement
        xj = positions[j, 0] - xi
        yj = positions[j, 1] - yi
        zj = positions[j, 2] - zi

        # PBC
        for d in range(3):
            bl = box_bounds[d, 1] - box_bounds[d, 0]
            if d == 0:
                if xj > 0.5 * bl:
                    xj -= bl
                elif xj < -0.5 * bl:
                    xj += bl
            elif d == 1:
                if yj > 0.5 * bl:
                    yj -= bl
                elif yj < -0.5 * bl:
                    yj += bl
            else:
                if zj > 0.5 * bl:
                    zj -= bl
                elif zj < -0.5 * bl:
                    zj += bl
        
        P[Ni, 0] = xj
        P[Ni, 1] = yj
        P[Ni, 2] = zj
        Ni += 1

    # If not enough neighbors, mark disordered
    if Ni == 0:
        out_types[i] = -1
        for quaternion in range(0, 4):
            out_quaternion[i, quaternion] = 0.0
        return

    # Variables to track best
    best_t = -1
    best_rmsd = 1e30
    best_q = cuda.local.array(4, float32)

    # Loop over templates
    for t in range(0, M):
        Kt = template_sizes[t]
        if Kt != Ni:
            continue

        # Load template
        for j in range(Kt):
            T[j, 0] = templates[t, j, 0]
            T[j, 1] = templates[t, j, 1]
            T[j, 2] = templates[t, j, 2]
        
        # Compute centroids
        cP[0] = cP[1] = cP[2] = 0.0
        cT[0] = cT[1] = cT[2] = 0.0
        for j in range(Kt):
            cP[0] += P[j, 0]
            cP[1] += P[j, 1]
            cP[2] += P[j, 2]
            cT[0] += T[j, 0]
            cT[1] += T[j, 1]
            cT[2] += T[j, 2]

        invK = 1.0 / Kt
        for d in range(3):
            cP[d] *= invK
            cT[d] *= invK
        
        # Compute covariance H
        H = cuda.local.array((3, 3), float32)
        for u in range(0, 3):
            for v in range(0, 3):
                H[u, v] = 0.0
        
        for j in range(Kt):
            px = P[j, 0] - cP[0]
            py = P[j, 1] - cP[1]
            pz = P[j, 2] - cP[2]
            tx = T[j, 0] - cT[0]
            ty = T[j, 1] - cT[1]
            tz = T[j, 2] - cT[2]
            H[0, 0] += px * tx
            H[0, 1] += px * ty
            H[0, 2] += px * tz
            H[1, 0] += py * tx
            H[1, 1] += py * ty
            H[1, 2] += py * tz
            H[2, 0] += pz * tx
            H[2, 1] += pz * ty
            H[2, 2] += pz * tz
        
        # Build 4x4 K matrix for quaternion
        K = cuda.local.array((4, 4), float32)
        trace = H[0, 0] + H[1, 1] + H[2, 2]
        K[0, 0] = trace
        K[0, 1] = H[1, 2] - H[2, 1] 
        K[0, 2] = H[2, 0] - H[0, 2]
        K[0, 3] = H[0, 1] - H[1, 0]
        K[1, 0] = K[0, 1]
        K[1, 1] = H[0, 0] - H[1, 1] - H[2, 2]
        K[1, 2] = H[0, 1] + H[1, 0]
        K[1, 3] = H[0, 2] + H[2, 0]
        K[2, 0] = K[0, 2]
        K[2, 1] = K[1, 2] 
        K[2, 2] = -H[0, 0] + H[1, 1] - H[2, 2]
        K[2, 3] = H[1, 2] + H[2, 1]
        K[3, 0] = K[0, 3]
        K[3, 1] = K[1, 3]
        K[3, 2] = K[2, 3]
        K[3, 3] = -H[0, 0] - H[1, 1] + H[2, 2]

        # Power iteration to find principal eigenvector of K
        q = cuda.local.array(4, float32)
        q[0] = 1.0
        q[1] = q[2] = q[3] = 0.0
        for _ in range(0, 10):
            # y = K * q
            y0 = K[0, 0] * q[0] + K[0, 1] * q[1] + K[0, 2] * q[2] + K[0, 3] * q[3]
            y1 = K[1, 0] * q[0] + K[1, 1] * q[1] + K[1, 2] * q[2] + K[1, 3] * q[3]
            y2 = K[2, 0] * q[0] + K[2, 1] * q[1] + K[2, 2] * q[2] + K[2, 3] * q[3]
            y3 = K[3, 0] * q[0] + K[3, 1] * q[1] + K[3, 2] * q[2] + K[3, 3] * q[3]
            norm = (y0 * y0 + y1 * y1 + y2 * y2 + y3 * y3)
            inv = 1.0 / (norm ** 0.5)
            q[0] = y0 * inv 
            q[1] = y1 * inv 
            q[2] = y2 * inv 
            q[3] = y3 * inv
        
        # Compute RMSD
        rmsd = 0.0
        for j in range(Kt):
            # Rotate template point
            tx = T[j, 0] - cT[0]
            ty = T[j, 1] - cT[1]
            tz = T[j, 2] - cT[2]
            # Quaternion rotate: v' = q * v * q^{-1}
            # Compute q*v
            w = q[0]
            x = q[1]
            y = q[2]
            z = q[3]
            ix = w * tx + y * tz - z * ty
            iy = w * ty + z * tx - x * tz
            iz = w * tz + x * ty - y * tx
            iw = -x * tx - y * ty - z * tz
            # then v' = (qv)*q^{-1}
            rx = ix * w + iw * -x + iy * -z - iz * -y
            ry = iy * w + iw * -y + iz * -x - ix * -z
            rz = iz * w + iw * -z + ix * -y - iy * -x
            dx2 = rx - (P[j, 0] - cP[0])
            dy2 = ry - (P[j, 1] - cP[1])
            dz2 = rz - (P[j, 2] - cP[2])
            rmsd += dx2 * dx2 + dy2 * dy2 + dz2 * dz2
        rmsd = (rmsd / Kt) ** 0.5
        # Chest best
        if rmsd < best_rmsd:
            best_rmsd = rmsd
            best_t = t
            for qk in range(0, 4):
                best_q[qk] = q[qk]
    # write out
    out_types[i] = best_t
    for qk in range(0, 4):
        out_quaternion[i, qk] = best_q[qk]

@cuda.jit
def burgers_kernel(
    positions,
    quaternions,
    ptm_types,
    templates,
    templates_sizes,
    loops,
    loop_lengths,
    box_bounds,
    local_scales,
    burgers_out
):
    '''
    Compute Burgers vector for each closed loop (circuit) on the GPU.

    Each thread handles one loop "idx":
        - Reads the loop of atom indices (length = loop_lengthds[idx])
        - For each edge (i -> j) in that loop:
            - Retrieves the local crystal orientation at i (from quaternion)
            - Transforms each template neighbor position to global coords
            - Finds the closest actual neighbor j to that template direction
            - Accumulate the displacement difference into the Burgers sum
        - Stores the resulting 3-component Burgers vector in burgers_out[idx]

    Args:
        positions (float32[:, 3]): Filtered atom coordinates.
        quaternions (float32[:, 4]): Local orientation quaternions.
        ptm_types (int32[:]): PTM types per atom.
        templates (float32[M, Kmax, 3]): Template neighbor coords.
        template_sizes (int32[M]): Number of neighbors per template.
        loops (int32[n_loops, Lmax]): Padded loop index arrays.
        loop_lengths (int32[n_loops]): Actual lengths of each loop.
        box_bounds (float32[3, 2]): Periodic box dims.
        burgers_out (float32[n_loops, 3]): Output Burgers vectors.
    '''
    idx = cuda.grid(1)
    number_of_loops = loops.shape[0]
    if idx >= number_of_loops:
        return
    
    # Initialize Burgers components
    b0 = 0.0
    b1 = 0.0
    b2 = 0.0

    # Box dimensions or zero
    if box_bounds.shape[0] == 3:
        Lx = box_bounds[0, 1] - box_bounds[0, 0]
        Ly = box_bounds[1, 1] - box_bounds[1, 0]
        Lz = box_bounds[2, 1] - box_bounds[2, 0]
    else:
        Lx = Ly = Lz = 0.0
    
    length = loop_lengths[idx]

    # Iterate circuit edges
    for segment in range(length):
        i = loops[idx, segment]
        j = loops[idx, (segment + 1) % length]
        ptm_type = ptm_types[i]
        K = templates_sizes[ptm_type]

        # TODO: Assume scale 1.0 or precomputed
        scale = local_scales[i]
        # print('Local Scale:', scale, 'for', i)
        
        # Inline quaternion -> R
        q0 = quaternions[i, 0]
        q1 = quaternions[i, 1]
        q2 = quaternions[i, 2]
        q3 = quaternions[i, 3]

        ww = q0 * q0
        xx = q1 * q1
        yy = q2 * q2
        zz = q3 * q3
        wx = q0 * q1
        wy = q0 * q2
        wz = q0 * q3
        xy = q1 * q2
        xz = q1 * q3
        yz = q2 * q3

        R00 = ww + xx - yy - zz
        R01 = 2 * (xy - wz)
        R02 = 2 * (xz + wy)
        R10 = 2 * (xy + wz)
        R11 = ww - xx + yy - zz
        R12 = 2 * (yz - wx)
        R20 = 2 * (xz - wy)
        R21 = 2 * (yz + wx) 
        R22 = ww - xx - yy + zz

        # Search best match among template neighbors
        best_d2 = 1e18
        dx_best = 0.0
        dy_best = 0.0
        dz_best = 0.0

        for k in range(K):
            Tx = templates[ptm_type, k, 0]
            Ty = templates[ptm_type, k, 1]
            Tz = templates[ptm_type, k, 2]
            px = (R00 * Tx + R01 * Ty + R02 * Tz) * scale + positions[i,0]
            py = (R10 * Tx + R11 * Ty + R12 * Tz) * scale + positions[i,1]
            pz = (R20 * Tx + R21 * Ty + R22 * Tz) * scale + positions[i,2]
            rx = positions[j,0]
            ry = positions[j,1]
            rz = positions[j,2]

            # PBC adjustment
            dx = rx - px
            if Lx > 0.0:
                if dx > 0.5 * Lx:
                    dx -= Lx
                elif dx < -0.5 * Lx:
                    dx += Lx
            dy = ry - py
            if Ly > 0.0:
                if dy > 0.5 * Ly:
                    dy -= Ly
                elif dy < -0.5 * Ly:
                    dy += Ly

            dz = rz - pz
            if Lz > 0.0:
                if dz > 0.5 * Lz:
                    dz -= Lz
                elif dz < -0.5 * Lz:
                    dz += Lz
            
            d2 = dx * dx + dy * dy + dz * dz
            if d2 < best_d2:
                best_d2 = d2
                dx_best = dx
                dy_best = dy
                dz_best = dz
        b0 += dx_best
        b1 += dy_best
        b2 += dz_best
    
    burgers_out[idx, 0] = b0
    burgers_out[idx, 1] = b1
    burgers_out[idx, 2] = b2

@cuda.jit
def classify_line_kernel(
    positions,
    loops_arr,
    loop_lens,
    burgers,
    types_out
):
    '''
    Classify each dislocation loop as edge, screw or mixed.

    For loop "idx":
        - Compute the loops tangent using its first segment.
        - Normalize that tangent vector.
        - Compute fraction `|b·t| / |b|`.
        - If fraction > 0.8 -> screw, < 0.2 -> edge, else mixed.

    Args:
        positions (float32[:, 3]): Atom coordinates.
        loops_arr (int32[n, Lmax]): Padded loops of atom indices.
        loop_lens (int32[n]): Actual loop lengths.
        burgers (float32[n, 3]): Burgers vectors per loop.
        types_out (int32[n]): Output loop type (0=edge,1=screw,2=mixed,-1=undef).
    '''
    idx = cuda.grid(1)
    number_of_loops = loops_arr.shape[0]
    if idx >= number_of_loops:
        return
    
    # Original loop length
    length = loop_lens[idx]
    if length < 2:
        types_out[idx] = -1
        return

    # Load Burgers vector
    bx = burgers[idx, 0]
    by = burgers[idx, 1]
    bz = burgers[idx, 2]
    
    # Get first segment for tangent
    i0 = loops_arr[idx, 0]
    j0 = loops_arr[idx, 1]
    tx = positions[j0, 0] - positions[i0, 0]
    ty = positions[j0, 1] - positions[i0, 1]
    tz = positions[j0, 2] - positions[i0, 2]

    # Normalize tangent
    mag = (tx * tx + ty * ty + tz * tz) ** 0.5
    if mag > 0:
        tx /= mag
        ty /= mag
        tz /= mag
    
    # Burgers dot tangent
    dot = bx * tx + by * ty + bz * tz
    bmag = (bx * bx + by * by + bz * bz) ** 0.5
    if bmag == 0:
        types_out[idx] = -1
        return
    
    frac = abs(dot) / bmag

    # Thresholds
    if frac > 0.8:
        # Screw
        types_out[idx] = 1
    elif frac < 0.2:
        # Edge
        types_out[idx] = 0
    else:
        # Mixed
        types_out[idx] = 2

@cuda.jit
def assign_and_find_neighbors_kernel(
    positions, box_bounds,
    cutoff2,
    nx, ny, nz, dx, dy, dz,
    lx, ly, lz,
    max_neighbors,
    head, linked,
    neigh_idx, counts
):
    i = cuda.grid(1)
    n = positions.shape[0]
    if i >= n:
        return

    xi = positions[i, 0]
    yi = positions[i, 1]
    zi = positions[i, 2]

    cx = int((xi - box_bounds[0,0]) / dx) % nx
    cy = int((yi - box_bounds[1,0]) / dy) % ny
    cz = int((zi - box_bounds[2,0]) / dz) % nz
    if cx < 0: cx += nx
    if cy < 0: cy += ny
    if cz < 0: cz += nz

    cell = cx + cy * nx + cz * nx * ny

    old = cuda.atomic.exch(head, cell, i)
    linked[i] = old

    cnt = 0
    for ox in (-1, 0, 1):
        ncx = (cx + ox + nx) % nx
        for oy in (-1, 0, 1):
            ncy = (cy + oy + ny) % ny
            for oz in (-1, 0, 1):
                ncz = (cz + oz + nz) % nz
                idx = ncx + ncy * nx + ncz * nx * ny
                j = head[idx]
                while j != -1:
                    if j > i:
                        xj = positions[j, 0]
                        yj = positions[j, 1]
                        zj = positions[j, 2]

                        dx_ = xj - xi
                        dy_ = yj - yi
                        dz_ = zj - zi
                        if dx_ > 0.5 * lx: dx_ -= lx
                        elif dx_ < -0.5 * lx: dx_ += lx
                        if dy_ > 0.5 * ly: dy_ -= ly
                        elif dy_ < -0.5 * ly: dy_ += ly
                        if dz_ > 0.5 * lz: dz_ -= lz
                        elif dz_ < -0.5 * lz: dz_ += lz

                        d2 = dx_ * dx_ + dy_ * dy_ + dz_ * dz_
                        if d2 <= cutoff2 and cnt < max_neighbors:
                            neigh_idx[i, cnt] = j
                            cnt += 1
                    j = linked[j]
    counts[i] = cnt

def find_neighbors_unified_kernel(
    positions, box_bounds, cutoff,
    lx, ly, lz,
    max_neighbors
):
    n = positions.shape[0]
    nx = max(1, int(lx // cutoff))
    ny = max(1, int(ly // cutoff))
    nz = max(1, int(lz // cutoff))
    dx = lx / nx
    dy = ly / ny
    dz = lz / nz
    cell_count = nx * ny * nz
    cutoff2 = cutoff * cutoff

    d_positions = cuda.to_device(positions)
    d_bounds = cuda.to_device(box_bounds)
    d_head = cuda.to_device(np.full(cell_count, -1, dtype=np.int64))
    d_linked = cuda.to_device(np.full(n, -1, dtype=np.int64))
    d_neigh = cuda.to_device(np.full((n, max_neighbors), -1, dtype=np.int64))
    d_counts = cuda.to_device(np.zeros(n, dtype=np.int64))

    blocks, threads_per_block = get_cuda_launch_config(n)
    assign_and_find_neighbors_kernel[blocks, threads_per_block](
        d_positions, d_bounds, cutoff2,
        nx, ny, nz, dx, dy, dz,
        lx, ly, lz, max_neighbors,
        d_head, d_linked,
        d_neigh, d_counts
    )
    neigh_idx = d_neigh.copy_to_host()
    counts = d_counts.copy_to_host()
    return neigh_idx, counts
