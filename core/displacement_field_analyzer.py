import numpy as np

# TODO: DUPLICATED CODE!
def quaternion_to_matrix(q):
    w, x, y, z = q
    ww = w*w; xx = x*x; yy = y*y; zz = z*z
    wx = w*x; wy = w*y; wz = w*z
    xy = x*y; xz = x*z; yz = y*z
    R = np.array([
        [ww + xx - yy - zz, 2*(xy - wz), 2*(xz + wy)],
        [2*(xy + wz), ww - xx + yy - zz, 2*(yz - wx)],
        [2*(xz - wy), 2*(yz + wx), ww - xx - yy + zz]
    ], dtype=np.float32)
    return R

class DisplacementFieldAnalyzer:
    def __init__(
        self,
        positions,
        connectivity,
        ptm_types,
        quaternions,
        templates,
        template_sizes,
        box_bounds=None
    ):
        # store
        self.positions = np.asarray(positions, dtype=np.float32)
        self.connectivity = connectivity
        self.ptm_types = np.asarray(ptm_types, dtype=int)
        self.quaternions = np.asarray(quaternions, dtype=np.float32)
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=int)
        self.N = self.positions.shape[0]
        # optional box for PBC
        if box_bounds is not None:
            self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        else:
            self.box_bounds = None

    def compute_displacement_field(self):
        disp = {}
        avg = np.zeros(self.N, dtype=np.float32)
        # loop atoms
        for i in range(self.N):
            t = self.ptm_types[i]
            if t < 0:
                continue
            nbrs = self.connectivity.get(i, [])
            if not nbrs:
                continue
            # ideal template directions
            Kt = self.template_sizes[t]
            T = self.templates[t, :Kt, :]  # (Kt,3)
            # local scale from real bonds
            Pidx = np.array(nbrs, dtype=int)
            Psub = self.positions[Pidx] - self.positions[i]
            scales = np.linalg.norm(Psub, axis=1)
            if scales.size == 0:
                continue
            scale = scales.mean()
            # build ideal positions in global frame
            R = quaternion_to_matrix(self.quaternions[i])
            ideal = (R @ T.T).T * scale + self.positions[i]  # (Kt,3)
            # now match each ideal to nearest real neighbor
            displacements = []
            for pred in ideal:
                # compute squared distances to connectivity neighbors
                diffs = self.positions[Pidx] - pred
                d2 = np.sum(diffs**2, axis=1)
                k = np.argmin(d2)
                # displacement vector = real - ideal
                disp_vec = (self.positions[Pidx[k]] - pred)
                displacements.append(disp_vec)
            D = np.vstack(displacements)  # (Kt,3)
            disp[i] = D
            avg[i] = np.linalg.norm(D, axis=1).mean()
        return disp, avg
