from numba import cuda
import numpy as np

@cuda.jit
def cna_kernel(
    positions,
    neighbors,
    box_bounds,
    cutoff_distance,
    max_neighbors,
    out_types,
    out_cna_signatures
):
    '''
    Common Neighbors Analysis (CNA) kernel.
    For each atom i:
        - Find all neighbors pairs within cutoff.
        - Count common neighbors between each pair.
        - Build CNA signature based on neighbor patterns.
        - Classify structure type based on signature.
    
    CNA signatures for common structures:
        - FCC: (4, 2, 1) - 12 neighbors, mostly 421 bonds
        - HCP: (4, 2, 1) + (4, 2, 2) - mixed 421 and 422 bonds
        - BCC: (6, 6, 6) - 8 neighbors, 666 bonds
        - ICO: (5, 5, 5) - 12 neighbors, 555 bonds
    '''
    i = cuda.grid(1)
    if i >= positions.shape[0]:
        return
    
    # Local arrays for neighbors and analysis
    neighbor_list = cuda.local.array(64, dtype=np.int32)
    # is_neighbor = cuda.local.array(64, dtype=cuda.boolean)
    
    # Load atom position
    # xi = positions[i, 0]
    # yi = positions[i, 1]
    # zi = positions[i, 2]

    # Gather valid neighbors
    Ni = 0
    for k in range(0, max_neighbors):
        j = neighbors[i, k]
        if j < 0:
            break
        neighbor_list[Ni] = j
        Ni += 1
    
    # Initialize CNA counters
    # FCC signature
    cna_421 = 0
    # HCP signature
    cna_422 = 0
    # BCC signature
    cna_666 = 0
    # ICO signature
    cna_555 = 0

    # Analyze all neighbors pairs
    for k1 in range(Ni):
        for k2 in range(k1 + 1, Ni):
            j1 = neighbor_list[k1]
            j2 = neighbor_list[k2]

            # Check if j1 and j2 are neighbors of each other
            x1 = positions[j1, 0]
            y1 = positions[j1, 1]
            z1 = positions[j1, 2]
            x2 = positions[j2, 0]
            y2 = positions[j2, 1]
            z2 = positions[j2, 2]

            # Calculate distance with PBC
            dx = x2 - y2
            dy = y2 - y1
            dz = z2 - z1

            # Apply periodic boundary conditions
            for d in range(0, 3):
                bl = box_bounds[d, 1] - box_bounds[d, 0]
                if d == 0:
                    if dx > 0.5 * bl:
                        dx -= bl
                    elif dx < -0.5 * bl:
                        dx += bl
                elif d == 1:
                    if dy > 0.5 * bl:
                        dy -= bl
                    elif dy < -0.5 * bl:
                        dy += bl
                else:
                    if dz > 0.5 * bl:
                        dz -= bl
                    elif dz < -0.5 * bl:
                        dz += bl
            dist_j1_j2 = (dx * dx + dy * dy + dz * dz) ** 0.5
            if dist_j1_j2 <= cutoff_distance:
                # j1 and j2 are neighbors, now count their common neighbors
                common_neighbors = 0
                # Check all other atoms to see if they're neighbors of both j1 and j2
                for k3 in range(Ni):
                    if k3 == k1 or k3 == k2:
                        continue
                    
                    j3 = neighbor_list[k3]
                    
                    # Check if j3 is neighbor of j1
                    x3 = positions[j3, 0]
                    y3 = positions[j3, 1]
                    z3 = positions[j3, 2]

                    # Distance j1 - j3
                    dx13 = x3 - x1
                    dy13 = y3 - y1
                    dz13 = z3 - z1

                    # PBC for j1-j3
                    for d in range(3):
                        bl = box_bounds[d, 1] - box_bounds[d, 0]
                        if d == 0:
                            if dx13 > 0.5 * bl:
                                dx13 -= bl
                            elif dx13 < -0.5 * bl:
                                dx13 += bl
                        elif d == 1:
                            if dy13 > 0.5 * bl:
                                dy13 -= bl
                            elif dy13 < -0.5 * bl:
                                dy13 += bl
                        else:
                            if dz13 > 0.5 * bl:
                                dz13 -= bl
                            elif dz13 < -0.5 * bl:
                                dz13 += bl

                    dist_j1_j3 = (dx13 * dx13 + dy13 * dy13 + dz13 * dz13) ** 0.5

                    # Distance j2 - j3
                    dx23 = x3 - x2
                    dy23 = y3 - y2
                    dz23 = z3 - z2
                    
                    # PBC for j2-j3
                    for d in range(3):
                        bl = box_bounds[d, 1] - box_bounds[d, 0]
                        if d == 0:
                            if dx23 > 0.5 * bl:
                                dx23 -= bl
                            elif dx23 < -0.5 * bl:
                                dx23 += bl
                        elif d == 1:
                            if dy23 > 0.5 * bl:
                                dy23 -= bl
                            elif dy23 < -0.5 * bl:
                                dy23 += bl
                        else:
                            if dz23 > 0.5 * bl:
                                dz23 -= bl
                            elif dz23 < -0.5 * bl:
                                dz23 += bl
                    
                    dist_j2_j3 = (dx23 * dx23 + dy23 * dy23 + dz23 * dz23) ** 0.5

                    # If j3 is neighbor of both j1 and j2, it's a common neighbor
                    if dist_j1_j3 <= cutoff_distance and dist_j2_j3 <= cutoff_distance:
                        common_neighbors += 1
                
                # Classify bond type based on common neighbors
                if common_neighbors == 2:
                    # Could be 421 (FCC) or 422 (HCP)
                    # TODO: Need to check if the common neighbors are connected
                    cna_421 += 1
                elif common_neighbors == 4:
                    # Characteristic of 422 (HCP)
                    cna_422 += 1
                elif common_neighbors == 6:
                    # Characteristic of 666 (BCC)
                    cna_666 += 1
                elif common_neighbors == 5:
                    # Characteristic of 555 (ICO)
                    cna_555 += 1

    # Store CNA signature
    out_cna_signatures[i, 0] = cna_421
    out_cna_signatures[i, 1] = cna_422
    out_cna_signatures[i, 2] = cna_666

    # Classify structure type based on dominat signature
    # Unknown/Disordered
    structure_type = -1

    # Close-packed structures need ~12 neighbors
    if Ni >= 12:
        # Predominantly 421 bonds
        if cna_421 >= 8:
            # FCC
            structure_type = 0
        # Mixed 421/422
        elif cna_421 >= 4 and cna_422 >= 4:
            # HCP
            structure_type = 1
        # Predominantly 555 bonds
        elif cna_555 >= 8:
            # ICO
            structure_type = 4
    # BCC coordination
    elif Ni >= 8:
        # Predominantly 666 bonds
        if cna_666 >= 6:
            # BCC
            structure_type = 2
    # Lower coordination
    elif Ni >= 4:
        # Surface/Defect
        structure_type = 3
    out_types[i] = structure_type