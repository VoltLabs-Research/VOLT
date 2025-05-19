from numba import cuda, float32

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
        q[0] = 1.0; 
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

        R00 = ww + xx - yy - zz; 
        R01 = 2 * (xy - wz); 
        R02 = 2 * (xz + wy)
        R10 = 2 * (xy + wz);
        R11 = ww - xx + yy - zz; 
        R12 = 2 * (yz - wx)
        R20 = 2 * (xz - wy); 
        R21 = 2 * (yz + wx); 
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
            rx = positions[j,0]; 
            ry = positions[j,1]; 
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