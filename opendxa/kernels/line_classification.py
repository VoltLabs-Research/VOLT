from numba import cuda

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