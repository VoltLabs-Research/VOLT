from numba import cuda

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