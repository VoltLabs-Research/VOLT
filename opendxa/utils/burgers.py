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


def match_to_crystal_basis(burgers_vector, crystal_type='fcc', lattice_parameter=1.0):
    """
    Match a Burgers vector to the appropriate crystal basis
    """
    magnitude = norm(burgers_vector)
    if magnitude < 1e-8:
        return np.zeros(3), 0.0
    
    if crystal_type.lower() == 'fcc':
        # Use existing FCC basis
        return match_to_fcc_basis(burgers_vector)
    
    elif crystal_type.lower() == 'hcp':
        # HCP basis vectors: 1/3<10-10> partials
        hcp_basis = np.array([
            [1, 0, 0], [-1/2, np.sqrt(3)/2, 0], [-1/2, -np.sqrt(3)/2, 0]
        ]) / 3.0 * lattice_parameter
        
        normed_basis = hcp_basis / norm(hcp_basis, axis=1, keepdims=True)
        burger_norm = burgers_vector / magnitude
        dots = normed_basis @ burger_norm
        i = np.argmax(np.abs(dots))
        matched_burger = hcp_basis[i] * np.sign(dots[i])
        alignment = dots[i]
        return matched_burger, alignment
    
    elif crystal_type.lower() == 'bcc':
        # BCC basis vectors: 1/2<111> perfect
        bcc_basis = np.array([
            [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
            [-1, -1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]
        ]) / 2.0 * lattice_parameter
        
        normed_basis = bcc_basis / norm(bcc_basis, axis=1, keepdims=True)
        burger_norm = burgers_vector / magnitude
        dots = normed_basis @ burger_norm
        i = np.argmax(np.abs(dots))
        matched_burger = bcc_basis[i] * np.sign(dots[i])
        alignment = dots[i]
        return matched_burger, alignment
    
    else:
        # Default: return original vector with perfect alignment
        return burgers_vector, 1.0

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