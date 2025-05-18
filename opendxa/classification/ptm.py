from numba import cuda, float32
from opendxa.utils.cuda import get_cuda_launch_config
import numpy as np

@cuda.jit
def ptm_kernel(
    positions, neighbors, box_bounds,
    templates, template_sizes, M,
    max_neighbors,
    out_types, out_quat
):
    '''
    GPU PTM kernel:
    - For each atom i:
      1) Gather neighbor positions into local array P[K_i][3]
      2) For each template t in 0..M-1:
         a) Get template neighbor coords T[K_t][3]
         b) Compute centroids cP, cT
         c) Compute covariance H = sum_j (P_j - cP) (T_j - cT)^T
         d) Build 4x4 K matrix from H
         e) Compute principal eigenvector (quaternion) via power iteration
         f) Rotate T by quaternion and compute RMSD with P
      3) Pick t with minimal RMSD: write out_types[i]=t, out_quat[i]=quat
    '''
    i = cuda.grid(1)
    if i >= positions.shape[0]:
        return
    # Shared local arrays
    P = cuda.local.array((64,3), float32)
    T = cuda.local.array((64,3), float32)
    cP = cuda.local.array(3, float32)
    cT = cuda.local.array(3, float32)
    # Load atom position
    xi = positions[i,0]
    yi = positions[i,1]
    zi = positions[i,2]
    # Gather neighbors
    Ni = 0
    for k in range(max_neighbors):
        j = neighbors[i,k]
        if j < 0:
            break
        # displacement
        xj = positions[j,0] - xi
        yj = positions[j,1] - yi
        zj = positions[j,2] - zi
        # PBC
        for d in range(3):
            bl = box_bounds[d,1] - box_bounds[d,0]
            if d == 0:
                if xj > 0.5*bl: 
                    xj -= bl
                elif xj < -0.5*bl: 
                    xj += bl
            elif d == 1:
                if yj > 0.5*bl: 
                    yj -= bl
                elif yj < -0.5*bl: 
                    yj += bl
            else:
                if zj > 0.5*bl:
                    zj -= bl
                elif zj < -0.5*bl:
                    zj += bl
        P[Ni,0] = xj; P[Ni,1] = yj; P[Ni,2] = zj
        Ni += 1
    # If not enough neighbors, mark disordered
    if Ni == 0:
        out_types[i] = -1
        for q in range(4): out_quat[i,q] = 0.0
        return
    # Variables to track best
    best_t = -1
    best_rmsd = 1e30
    best_q = cuda.local.array(4, float32)
    # Loop over templates
    for t in range(M):
        Kt = template_sizes[t]
        if Kt != Ni:
            continue
        # Load template
        for j in range(Kt):
            T[j,0] = templates[t,j,0]
            T[j,1] = templates[t,j,1]
            T[j,2] = templates[t,j,2]
        # Compute centroids
        cP[0]=cP[1]=cP[2]=0.0
        cT[0]=cT[1]=cT[2]=0.0
        for j in range(Kt):
            cP[0] += P[j,0]; cP[1] += P[j,1]; cP[2] += P[j,2]
            cT[0] += T[j,0]; cT[1] += T[j,1]; cT[2] += T[j,2]
        invK = 1.0 / Kt
        for d in range(3):
            cP[d] *= invK; cT[d] *= invK
        # Compute covariance H
        H = cuda.local.array((3,3), float32)
        for u in range(3):
            for v in range(3):
                H[u,v] = 0.0
        for j in range(Kt):
            px = P[j,0] - cP[0]
            py = P[j,1] - cP[1]
            pz = P[j,2] - cP[2]
            tx = T[j,0] - cT[0]
            ty = T[j,1] - cT[1]
            tz = T[j,2] - cT[2]
            H[0,0] += px*tx; H[0,1] += px*ty; H[0,2] += px*tz
            H[1,0] += py*tx; H[1,1] += py*ty; H[1,2] += py*tz
            H[2,0] += pz*tx; H[2,1] += pz*ty; H[2,2] += pz*tz
        # Build 4x4 K matrix for quaternion
        K = cuda.local.array((4,4), float32)
        trace = H[0,0] + H[1,1] + H[2,2]
        K[0,0] = trace; K[0,1] = H[1,2] - H[2,1]; K[0,2] = H[2,0] - H[0,2]; K[0,3] = H[0,1] - H[1,0]
        K[1,0] = K[0,1]; K[1,1] = H[0,0] - H[1,1] - H[2,2]
        K[1,2] = H[0,1] + H[1,0]; K[1,3] = H[0,2] + H[2,0]
        K[2,0] = K[0,2]; K[2,1] = K[1,2]; K[2,2] = -H[0,0] + H[1,1] - H[2,2]
        K[2,3] = H[1,2] + H[2,1]; K[3,0] = K[0,3]
        K[3,1] = K[1,3]; K[3,2] = K[2,3]; K[3,3] = -H[0,0] - H[1,1] + H[2,2]
        # Power iteration to find principal eigenvector of K
        q = cuda.local.array(4, float32)
        q[0]=1.0; q[1]=q[2]=q[3]=0.0
        for _ in range(10):
            # y = K * q
            y0 = K[0,0]*q[0] + K[0,1]*q[1] + K[0,2]*q[2] + K[0,3]*q[3]
            y1 = K[1,0]*q[0] + K[1,1]*q[1] + K[1,2]*q[2] + K[1,3]*q[3]
            y2 = K[2,0]*q[0] + K[2,1]*q[1] + K[2,2]*q[2] + K[2,3]*q[3]
            y3 = K[3,0]*q[0] + K[3,1]*q[1] + K[3,2]*q[2] + K[3,3]*q[3]
            norm = (y0*y0 + y1*y1 + y2*y2 + y3*y3)
            inv = 1.0 / (norm**0.5)
            q[0] = y0*inv; q[1] = y1*inv; q[2] = y2*inv; q[3] = y3*inv
        # compute RMSD
        rmsd = 0.0
        for j in range(Kt):
            # rotate template point
            tx = T[j,0] - cT[0]; ty = T[j,1] - cT[1]; tz = T[j,2] - cT[2]
            # quaternion rotate: v' = q * v * q^{-1}
            # compute q*v
            w= q[0]; x=q[1]; y=q[2]; z=q[3]
            ix =  w*tx + y*tz - z*ty
            iy =  w*ty + z*tx - x*tz
            iz =  w*tz + x*ty - y*tx
            iw = -x*tx - y*ty - z*tz
            # then v' = (qv)*q^{-1}
            rx = ix*w + iw*-x + iy*-z - iz*-y
            ry = iy*w + iw*-y + iz*-x - ix*-z
            rz = iz*w + iw*-z + ix*-y - iy*-x
            dx2 = rx - (P[j,0] - cP[0])
            dy2 = ry - (P[j,1] - cP[1])
            dz2 = rz - (P[j,2] - cP[2])
            rmsd += dx2*dx2 + dy2*dy2 + dz2*dz2
        rmsd = (rmsd / Kt)**0.5
        # check best
        if rmsd < best_rmsd:
            best_rmsd = rmsd
            best_t = t
            for qk in range(4): 
                best_q[qk] = q[qk]
    # write out
    out_types[i] = best_t
    for qk in range(4):
        out_quat[i,qk] = best_q[qk]

def get_ptm_templates():
    # 1) Simple Cubic (SC): 6 neighbors
    sc = np.array([
        [ 1, 0, 0], [-1, 0, 0],
        [ 0, 1, 0], [ 0,-1, 0],
        [ 0, 0, 1], [ 0, 0,-1],
    ], dtype=np.float32)

    # 2) Body-Centered Cubic (BCC): 8 neighbors
    bcc = np.array([
        [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5],
        [ 0.5, -0.5,  0.5], [ 0.5,  0.5, -0.5],
        [-0.5, -0.5,  0.5], [-0.5,  0.5, -0.5],
        [ 0.5, -0.5, -0.5], [-0.5, -0.5, -0.5],
    ], dtype=np.float32)

    # 3) Face-Centered Cubic (FCC): 12 neighbors
    fcc = np.array([
        [ 0.0,  0.5,  0.5], [ 0.0,  0.5, -0.5],
        [ 0.0, -0.5,  0.5], [ 0.0, -0.5, -0.5],
        [ 0.5,  0.0,  0.5], [ 0.5,  0.0, -0.5],
        [-0.5,  0.0,  0.5], [-0.5,  0.0, -0.5],
        [ 0.5,  0.5,  0.0], [ 0.5, -0.5,  0.0],
        [-0.5,  0.5,  0.0], [-0.5, -0.5,  0.0],
    ], dtype=np.float32)

    # 4) Hexagonal Close-Packed (HCP): 12 neighbors
    #    We build a small HCP fragment and pick all points at distance ~1.0
    a = 1.0
    c = np.sqrt(8.0/3.0)
    a1 = np.array([1, 0, 0], dtype=np.float32)*a
    a2 = np.array([0.5, np.sqrt(3)/2, 0], dtype=np.float32)*a
    a3 = np.array([0, 0, c], dtype=np.float32)*a
    basis = [
        np.array([0.0, 0.0, 0.0], dtype=np.float32),
        np.array([2/3, 1/3, 1/2], dtype=np.float32),
    ]
    pts = []
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for k in (-1, 0, 1):
                for b in basis:
                    frac = b + np.array([i, j, k], dtype=np.float32)
                    P = frac[0]*a1 + frac[1]*a2 + frac[2]*a3
                    pts.append(P)
    pts = np.array(pts, dtype=np.float32)
    d2 = np.sum(pts**2, axis=1)
    mask = (d2 > 1e-6) & (d2 < (1.01)**2)
    hcp = np.unique(np.round(pts[mask], 5), axis=0)

    # 5) Icosahedral (ICO): 12 vertices of regular icosahedron
    phi = (1 + np.sqrt(5)) / 2
    ico = np.array([
        [ 0,  1,  phi], [ 0, -1,  phi],
        [ 0,  1, -phi], [ 0, -1, -phi],
        [ 1,  phi,  0], [-1,  phi,  0],
        [ 1, -phi,  0], [-1, -phi,  0],
        [ phi,  0,  1], [-phi,  0,  1],
        [ phi,  0, -1], [-phi,  0, -1],
    ], dtype=np.float32)
    # Normalize to neighbor distance ≈1.0
    ico /= np.linalg.norm(ico, axis=1)[:,None]

    # Collect and pad
    templates_list = [sc, bcc, fcc, hcp, ico]
    sizes = [t.shape[0] for t in templates_list]
    M = len(templates_list)
    Kmax = max(sizes)

    templates = np.zeros((M, Kmax, 3), dtype=np.float32)
    for idx, tpl in enumerate(templates_list):
        templates[idx, :tpl.shape[0], :] = tpl

    return templates, np.array(sizes, dtype=np.int32) 

class PTMLocalClassifier:
    def __init__(
        self, positions, box_bounds, neighbor_dict,
        templates, template_sizes, max_neighbors=32
    ):
        self.N = len(positions)
        self.positions = np.asarray(positions, dtype=np.float32)
        self.box_bounds = np.asarray(box_bounds, dtype=np.float32)
        self.max_neighbors = max_neighbors

        # Prepare neighbor indices array
        self.neighbors = np.full((self.N, max_neighbors), -1, dtype=np.int32)
        for i, nbrs in neighbor_dict.items():
            for k, j in enumerate(nbrs[:max_neighbors]):
                self.neighbors[i,k] = j

        # Templates
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=np.int32)
        self.M = self.templates.shape[0]

    def classify(self):
        # Copy to device
        d_pos = cuda.to_device(self.positions)
        d_neigh = cuda.to_device(self.neighbors)
        d_box = cuda.to_device(self.box_bounds)
        d_templates = cuda.to_device(self.templates)
        d_tmpl_sz = cuda.to_device(self.template_sizes)
        # Output arrays
        d_types = cuda.device_array(self.N, dtype=np.int32)
        d_quat = cuda.device_array((self.N, 4), dtype=np.float32)
        # Launch kernel
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        ptm_kernel[blocks, threads_per_block](
            d_pos, d_neigh, d_box,
            d_templates, d_tmpl_sz, self.M,
            self.max_neighbors,
            d_types, d_quat
        )
        # Copy back
        types = d_types.copy_to_host()
        quats = d_quat.copy_to_host()
        return types, quats