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
