from numba import cuda, float32, int32, types
from opendxa.utils.cuda import get_cuda_launch_config
import numpy as np

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
