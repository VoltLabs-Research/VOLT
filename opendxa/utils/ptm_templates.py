import numpy as np

_NEAR_ZERO = 1e-6
_HCP_TOLERANCE = 0.01  # allow ±1% distance variation
_FLOAT = np.float32
_INT = np.int32

def _build_hcp_fragment(a: float = 1.0, tolerance: float = _HCP_TOLERANCE) -> np.ndarray:
    '''
    Generate a small hexagonal-close-packed (HCP) neighbor shell.
    We tile a 3×3×3 cell of the HCP lattice, then select those points
    whose distance from the origin is ≈1.0 (within tolerance).
    '''
    # lattice parameters
    c = np.sqrt(8.0/3.0) * a
    # lattice vectors
    a1 = np.array([1, 0, 0], dtype=_FLOAT) * a
    a2 = np.array([0.5, np.sqrt(3)/2, 0], dtype=_FLOAT) * a
    a3 = np.array([0, 0, 1], dtype=_FLOAT) * c

    # two basis positions in the unit cell
    basis = [
        np.array([0.0, 0.0, 0.0], dtype=_FLOAT),
        np.array([2/3, 1/3, 1/2], dtype=_FLOAT),
    ]

    # gather all candidates
    candidates = []
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in (-1, 0, 1):
                for b in basis:
                    fractional = b + np.array([i, j, k], dtype=_FLOAT)
                    point = (fractional[0]*a1 +
                             fractional[1]*a2 +
                             fractional[2]*a3)
                    candidates.append(point)

    pts = np.stack(candidates)
    distances_sq = np.sum(pts*pts, axis=1)
    mask = (distances_sq > _NEAR_ZERO) & \
           (distances_sq < (1.0 + tolerance)**2)

    # unique and quantize to avoid floating-point near-duplicates
    unique_pts = np.unique(np.round(pts[mask], 5), axis=0)
    return unique_pts.astype(_FLOAT)

def _build_icosahedron() -> np.ndarray:
    '''
    Build the 12 vertices of a regular icosahedron, normalized to unit distance.
    '''
    phi = (1 + np.sqrt(5)) / 2
    verts = np.array([
        [ 0,  1,  phi], [ 0, -1,  phi],
        [ 0,  1, -phi], [ 0, -1, -phi],
        [ 1,  phi,  0], [-1,  phi,  0],
        [ 1, -phi,  0], [-1, -phi,  0],
        [ phi,  0,  1], [-phi,  0,  1],
        [ phi,  0, -1], [-phi,  0, -1],
    ], dtype=_FLOAT)

    # normalize each vertex to length=1
    norms = np.linalg.norm(verts, axis=1, keepdims=True)
    return (verts / norms).astype(_FLOAT)

def get_ptm_templates():
    # Simple Cubic (SC) — 6 neighbors
    sc = np.array([
        [ 1, 0, 0], [-1, 0, 0],
        [ 0, 1, 0], [ 0,-1, 0],
        [ 0, 0, 1], [ 0, 0,-1],
    ], dtype=_FLOAT)

    # Body-Centered Cubic (BCC) 8 neighbors
    bcc = np.array([
        [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5],
        [ 0.5, -0.5,  0.5], [ 0.5,  0.5, -0.5],
        [-0.5, -0.5,  0.5], [-0.5,  0.5, -0.5],
        [ 0.5, -0.5, -0.5], [-0.5, -0.5, -0.5],
    ], dtype=_FLOAT)

    # Face-Centered Cubic (FCC) 12 neighbors
    fcc = np.array([
        [ 0,  0.5,  0.5], [ 0,  0.5, -0.5],
        [ 0, -0.5,  0.5], [ 0, -0.5, -0.5],
        [ 0.5,  0,  0.5], [ 0.5,  0, -0.5],
        [-0.5,  0,  0.5], [-0.5,  0, -0.5],
        [ 0.5,  0.5,  0], [ 0.5, -0.5,  0],
        [-0.5,  0.5,  0], [-0.5, -0.5,  0],
    ], dtype=_FLOAT)

    # Hexagonal Close-Packed (HCP) ~12 neighbors
    hcp = _build_hcp_fragment()

    # Icosahedral (ICO) 12 vertices
    ico = _build_icosahedron()

    # collect and pad
    templates_list = [sc, bcc, fcc, hcp, ico]
    sizes = [tpl.shape[0] for tpl in templates_list]
    max_neighbors = max(sizes)
    num_templates = len(templates_list)

    templates_array = np.zeros((num_templates, max_neighbors, 3), dtype=_FLOAT)
    for idx, tpl in enumerate(templates_list):
        templates_array[idx, :tpl.shape[0], :] = tpl

    return templates_array, np.array(sizes, dtype=_INT)
