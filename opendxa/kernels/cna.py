from numba import cuda, int32, float64
from opendxa.kernels.pbc import apply_pbc_component
import math

@cuda.jit
def cna_kernel(
    positions,
    neighbors,
    box_bounds,
    cutoff_distance,
    max_neighbors,
    out_types,
    out_cna_signatures,
    tolerance,
    adaptive_cutoff,
    neighbor_tolerance
):
    i = cuda.grid(1)
    N_atoms = positions.shape[0]

    # 1) Thread bounds checking with safety margin
    if i >= N_atoms:
        return

    # 2) Enhanced input validation
    if cutoff_distance <= tolerance or cutoff_distance != cutoff_distance:  # NaN check
        _set_invalid_output(i, out_types, out_cna_signatures)
        return

    # 3) Validate box bounds for PBC calculations
    bx = box_bounds[0, 1] - box_bounds[0, 0]
    by = box_bounds[1, 1] - box_bounds[1, 0]
    bz = box_bounds[2, 1] - box_bounds[2, 0]
    
    if bx <= tolerance or by <= tolerance or bz <= tolerance:
        _set_invalid_output(i, out_types, out_cna_signatures)
        return

    # 4) Validate neighbors array dimensions
    total_nbr_cols = neighbors.shape[1]
    if max_neighbors > total_nbr_cols or max_neighbors <= 0:
        _set_invalid_output(i, out_types, out_cna_signatures)
        return

    # 5) Enhanced local buffer management with safety checks
    MAX_LOCAL_NEIGH = 128  
    effective_max_neighbors = min(max_neighbors, MAX_LOCAL_NEIGH)
    
    neighbor_list = cuda.local.array(MAX_LOCAL_NEIGH, int32)
    neighbor_distances = cuda.local.array(MAX_LOCAL_NEIGH, float64)

    # 6) Robust neighbor gathering with distance validation
    xi = positions[i, 0]
    yi = positions[i, 1]
    zi = positions[i, 2]
    
    Ni = _gather_validated_neighbors(
        i, xi, yi, zi, positions, neighbors, effective_max_neighbors, 
        N_atoms, cutoff_distance, bx, by, bz, neighbor_list, 
        neighbor_distances, tolerance, neighbor_tolerance
    )

    # 7) Enhanced early exit conditions
    if Ni < 2:
        _set_invalid_output(i, out_types, out_cna_signatures)
        return

    # 8) Initialize CNA counters with extended signatures
    cna_421 = int32(0)
    cna_422 = int32(0)
    cna_666 = int32(0)
    cna_555 = int32(0)
    # Additional signature for defects
    cna_544 = int32(0)
    # Additional signature for surfaces
    cna_663 = int32(0) 

    # 9) Enhanced CNA calculation with improved precision
    effective_cutoff = cutoff_distance
    if adaptive_cutoff and Ni > 0:
        # Use average neighbor distance for adaptive cutoff
        avg_dist = _calculate_average_neighbor_distance(neighbor_distances, Ni)
        effective_cutoff = min(cutoff_distance, avg_dist * (1.0 + neighbor_tolerance))

    # 10) Robust bond pair analysis
    for k1 in range(Ni):
        j1 = neighbor_list[k1]
        x1 = positions[j1, 0]
        y1 = positions[j1, 1]
        z1 = positions[j1, 2]

        for k2 in range(k1 + 1, Ni):
            j2 = neighbor_list[k2]
            x2 = positions[j2, 0]
            y2 = positions[j2, 1]
            z2 = positions[j2, 2]

            # 11) Enhanced distance calculation with numerical stability
            dx, dy, dz = _calculate_pbc_distance(x1, y1, z1, x2, y2, z2, bx, by, bz)
            dist_j1_j2_sq = dx*dx + dy*dy + dz*dz
            
            # Use squared distances to avoid sqrt when possible
            if dist_j1_j2_sq > effective_cutoff * effective_cutoff + tolerance:
                continue

            dist_j1_j2 = math.sqrt(dist_j1_j2_sq)
            if dist_j1_j2 > effective_cutoff:
                continue

            # 12) Enhanced common neighbor counting with better precision
            common_neighbors = _count_common_neighbors_robust(
                j1, j2, x1, y1, z1, x2, y2, z2, neighbor_list, Ni, 
                positions, effective_cutoff, bx, by, bz, tolerance, k1, k2
            )

            # 13) Extended CNA signature classification
            if common_neighbors == 2:
                cna_421 += 1
            elif common_neighbors == 4:
                cna_422 += 1
            elif common_neighbors == 6:
                cna_666 += 1
            elif common_neighbors == 5:
                cna_555 += 1
            elif common_neighbors == 1:
                cna_544 += 1  # Surface/defect signature
            elif common_neighbors == 3:
                cna_663 += 1  # Interface signature

    # 14) Write enhanced CNA signature (6 columns for better precision)
    out_cna_signatures[i, 0] = cna_421
    out_cna_signatures[i, 1] = cna_422
    out_cna_signatures[i, 2] = cna_666
    out_cna_signatures[i, 3] = cna_555
    if out_cna_signatures.shape[1] > 4:
        out_cna_signatures[i, 4] = cna_544
    if out_cna_signatures.shape[1] > 5:
        out_cna_signatures[i, 5] = cna_663

    # 15) Enhanced structure classification with improved robustness
    structure_type = _classify_structure_robust(
        Ni, cna_421, cna_422, cna_666, cna_555, cna_544, cna_663
    )

    out_types[i] = structure_type

@cuda.jit(device=True)
def _set_invalid_output(i, out_types, out_cna_signatures):
    """Helper function to set invalid output values."""
    out_types[i] = int32(-1)
    for col in range(min(6, out_cna_signatures.shape[1])):
        out_cna_signatures[i, col] = int32(0)

@cuda.jit(device=True)
def _calculate_pbc_distance(x1, y1, z1, x2, y2, z2, bx, by, bz):
    """Enhanced PBC distance calculation with improved numerical stability."""
    dx = x2 - x1
    dy = y2 - y1
    dz = z2 - z1

    dx = apply_pbc_component(dx, bx)
    dy = apply_pbc_component(dy, by)
    dz = apply_pbc_component(dz, bz)
    
    return dx, dy, dz

@cuda.jit(device=True)
def _gather_validated_neighbors(
    i, xi, yi, zi, positions, neighbors, max_neighbors, N_atoms, 
    cutoff_distance, bx, by, bz, neighbor_list, neighbor_distances, 
    tolerance, neighbor_tolerance
):
    """Enhanced neighbor gathering with validation and distance caching."""
    Ni = 0
    cutoff_sq = cutoff_distance * cutoff_distance
    
    for k in range(max_neighbors):
        j = neighbors[i, k]
        if j < 0 or j >= N_atoms or j == i:
            break
            
        # Calculate distance to validate neighbor
        xj = positions[j, 0]
        yj = positions[j, 1]
        zj = positions[j, 2]
        
        dx, dy, dz = _calculate_pbc_distance(xi, yi, zi, xj, yj, zj, bx, by, bz)
        dist_sq = dx*dx + dy*dy + dz*dz
        
        if dist_sq <= cutoff_sq + tolerance:
            neighbor_list[Ni] = j
            neighbor_distances[Ni] = math.sqrt(dist_sq)
            Ni += 1
            
    return Ni

@cuda.jit(device=True)
def _calculate_average_neighbor_distance(neighbor_distances, Ni):
    """Calculate average neighbor distance for adaptive cutoff."""
    if Ni == 0:
        return 0.0
    
    total_dist = 0.0
    for k in range(Ni):
        total_dist += neighbor_distances[k]
    
    return total_dist / float64(Ni)

@cuda.jit(device=True)
def _count_common_neighbors_robust(
    j1, j2, x1, y1, z1, x2, y2, z2, neighbor_list, Ni, positions, 
    cutoff_distance, bx, by, bz, tolerance, k1, k2
):
    """Enhanced common neighbor counting with improved numerical precision."""
    common_neighbors = int32(0)
    cutoff_sq = cutoff_distance * cutoff_distance
    
    for k3 in range(Ni):
        if k3 == k1 or k3 == k2:
            continue
            
        j3 = neighbor_list[k3]
        x3 = positions[j3, 0]
        y3 = positions[j3, 1]
        z3 = positions[j3, 2]

        # Check j1-j3 distance
        dx13, dy13, dz13 = _calculate_pbc_distance(x1, y1, z1, x3, y3, z3, bx, by, bz)
        dist_j1_j3_sq = dx13*dx13 + dy13*dy13 + dz13*dz13
        
        if dist_j1_j3_sq > cutoff_sq + tolerance:
            continue

        # Check j2-j3 distance
        dx23, dy23, dz23 = _calculate_pbc_distance(x2, y2, z2, x3, y3, z3, bx, by, bz)
        dist_j2_j3_sq = dx23*dx23 + dy23*dy23 + dz23*dz23
        
        if dist_j2_j3_sq <= cutoff_sq + tolerance:
            common_neighbors += 1

    return common_neighbors

@cuda.jit(device=True)
def _classify_structure_robust(Ni, cna_421, cna_422, cna_666, cna_555, cna_544, cna_663):
    """Enhanced structure classification with improved robustness and precision."""
    structure_type = int32(-1)
    
    # Enhanced classification thresholds
    if Ni >= 12:
        # Close-packed structures (coordination 12)
        total_cna = cna_421 + cna_422 + cna_666 + cna_555
        
        # FCC: predominantly 421 bonds
        if cna_421 >= 8 and cna_421 >= total_cna * 0.6:
            structure_type = int32(0)  # FCC
        # HCP: mix of 421 and 422 bonds  
        elif cna_421 >= 4 and cna_422 >= 4 and (cna_421 + cna_422) >= total_cna * 0.7:
            structure_type = int32(1)  # HCP
        # Icosahedral: predominantly 555 bonds
        elif cna_555 >= 8 and cna_555 >= total_cna * 0.6:
            structure_type = int32(4)  # ICO
            
    elif Ni >= 8 and Ni <= 10:
        # BCC-like coordination (8-10 neighbors)
        if cna_666 >= 6:
            structure_type = int32(2)  # BCC
            
    elif Ni >= 4 and Ni < 8:
        # Lower coordination - surface, defect, or other
        if cna_544 > 0 or cna_663 > 0:
            # Surface/defect
            structure_type = int32(3) 
        else:
            # Other/unknown
            structure_type = int32(5)
            
    elif Ni >= 2 and Ni < 4:
        # Very low coordination - likely surface or highly defective
        # Highly defective
        structure_type = int32(6)
        
    return structure_type
