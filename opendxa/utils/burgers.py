from numpy.linalg import norm
import numpy as np


def match_to_fcc_basis(burgers_vector):
    fcc_basis = np.array([
        [ 1,  1,  2], [ 1, -1,  2], [-1,  1,  2], [-1, -1,  2],
        [ 1,  2,  1], [ 1, -2,  1], [-1,  2,  1], [-1, -2,  1],
        [ 2,  1,  1], [ 2, -1,  1], [-2,  1,  1], [-2, -1,  1]
    ]) / 6.0
    normed_basis = fcc_basis / norm(fcc_basis, axis=1, keepdims=True)
    burger_norm = burgers_vector / norm(burgers_vector)
    dots = normed_basis @ burger_norm
    i = np.argmax(np.abs(dots))
    matched_burger = fcc_basis[i] * np.sign(dots[i])
    alignment = dots[i]
    return matched_burger, alignment


def compute_local_scales(positions, connectivity, box_bounds=None):
    '''
    For each atom i, compute the average bond length to its connected neighbors,
    applying periodic boundary conditions if box_bounds is provided.
    Returns an array of shape (N,) of dtype float32.
    '''
    pos = np.asarray(positions, dtype=np.float32)
    N = pos.shape[0]
    scales = np.zeros(N, dtype=np.float32)

    # Convert box_bounds to ndarray for easy indexing
    if box_bounds is not None:
        box = np.asarray(box_bounds, dtype=np.float32)
    else:
        box = None

    for i, nbrs in connectivity.items():
        if not nbrs:
            scales[i] = 1.0
            continue
        diffs = pos[nbrs] - pos[i]

        # apply PBC if requested
        if box is not None:
            for d in range(3):
                L = box[d,1] - box[d,0]
                if L <= 0.0:
                    continue
                col = diffs[:,d]
                col[col >  0.5*L] -= L
                col[col < -0.5*L] += L
                diffs[:,d] = col

        dists = np.linalg.norm(diffs, axis=1)
        scales[i] = float(dists.mean())

    return scales