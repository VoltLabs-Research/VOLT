from numba import cuda
from utils.cuda import get_cuda_launch_config
import numpy as np
import math

# CUDA kernel to compute Burgers vector for loops
@cuda.jit
def burgers_kernel(
    positions, quaternions, ptm_types,
    templates, template_sizes,
    loops, loop_lengths,
    box_bounds,
    burgers_out
):
    idx = cuda.grid(1)
    n_loops = loops.shape[0]
    if idx >= n_loops:
        return
    # Initialize Burgers components
    b0 = 0.0; b1 = 0.0; b2 = 0.0
    # box dims or zero
    if box_bounds.shape[0] == 3:
        Lx = box_bounds[0,1] - box_bounds[0,0]
        Ly = box_bounds[1,1] - box_bounds[1,0]
        Lz = box_bounds[2,1] - box_bounds[2,0]
    else:
        Lx = Ly = Lz = 0.0
    length = loop_lengths[idx]
    # iterate circuit edges
    for s in range(length):
        i = loops[idx, s]
        j = loops[idx, (s+1) % length]
        t = ptm_types[i]
        K = template_sizes[t]
        # assume scale=1.0 or precomputed
        scale = 1.0
        # inline quaternion->R
        q0 = quaternions[i,0]; q1 = quaternions[i,1]
        q2 = quaternions[i,2]; q3 = quaternions[i,3]
        ww=q0*q0; xx=q1*q1; yy=q2*q2; zz=q3*q3
        wx=q0*q1; wy=q0*q2; wz=q0*q3
        xy=q1*q2; xz=q1*q3; yz=q2*q3
        R00 = ww+xx-yy-zz; R01 = 2*(xy - wz); R02 = 2*(xz + wy)
        R10 = 2*(xy + wz); R11 = ww-xx+yy-zz; R12 = 2*(yz - wx)
        R20 = 2*(xz - wy); R21 = 2*(yz + wx); R22 = ww-xx-yy+zz
        # search best match among template neighbors
        best_d2 = 1e18
        dx_best=0.0; dy_best=0.0; dz_best=0.0
        for k in range(K):
            Tx = templates[t,k,0]; Ty = templates[t,k,1]; Tz = templates[t,k,2]
            px = (R00*Tx + R01*Ty + R02*Tz)*scale + positions[i,0]
            py = (R10*Tx + R11*Ty + R12*Tz)*scale + positions[i,1]
            pz = (R20*Tx + R21*Ty + R22*Tz)*scale + positions[i,2]
            rx = positions[j,0]; ry = positions[j,1]; rz = positions[j,2]
            # PBC adjustment
            dx = rx - px
            if Lx>0.0:
                if dx > 0.5*Lx: dx -= Lx
                elif dx < -0.5*Lx: dx += Lx
            dy = ry - py
            if Ly>0.0:
                if dy > 0.5*Ly: dy -= Ly
                elif dy < -0.5*Ly: dy += Ly
            dz = rz - pz
            if Lz>0.0:
                if dz > 0.5*Lz: dz -= Lz
                elif dz < -0.5*Lz: dz += Lz
            d2 = dx*dx + dy*dy + dz*dz
            if d2 < best_d2:
                best_d2 = d2; dx_best=dx; dy_best=dy; dz_best=dz
        b0 += dx_best; b1 += dy_best; b2 += dz_best
    burgers_out[idx,0] = b0
    burgers_out[idx,1] = b1
    burgers_out[idx,2] = b2

class BurgersCircuitEvaluator:
    def __init__(
        self, connectivity,
        positions, ptm_types, quaternions,
        templates, template_sizes,
        box_bounds=None
    ):
        self.conn = connectivity
        self.positions = np.asarray(positions, dtype=np.float32)
        self.ptm_types = np.asarray(ptm_types, dtype=np.int32)
        self.quaternions = np.asarray(quaternions, dtype=np.float32)
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=np.int32)
        self.N = self.positions.shape[0]
        if box_bounds is not None:
            self.box = np.asarray(box_bounds, dtype=np.float32)
        else:
            self.box = np.zeros((0,2), dtype=np.float32)
        # pre-store loops
        self.loops = self._find_loops()

    def _find_loops(self, max_length=8):
        loops = []
        def dfs(start, current, path):
            if len(path) > max_length: return
            for nbr in self.conn.get(current, []):
                if nbr == start and len(path) >= 3:
                    loops.append(path.copy()); return
                if nbr in path or nbr < start: continue
                path.append(nbr); dfs(start, nbr, path); path.pop()
        for i in range(self.N): dfs(i, i, [i])
        # unique
        unique=[]; seen=set()
        for loop in loops:
            key=tuple(sorted(loop))
            if key not in seen: seen.add(key); unique.append(loop)
        return unique

    def calculate_burgers(self):
        loops = self.loops
        n_loops = len(loops)
        if n_loops==0: return {}
        max_len = max(len(l) for l in loops)
        arr = -np.ones((n_loops, max_len), dtype=np.int32)
        lens = np.zeros(n_loops, dtype=np.int32)
        for idx, l in enumerate(loops):
            lens[idx]=len(l); arr[idx,:len(l)]=l
        # GPU buffers
        d_pos = cuda.to_device(self.positions)
        d_quat = cuda.to_device(self.quaternions)
        d_pt = cuda.to_device(self.ptm_types)
        d_tpl = cuda.to_device(self.templates)
        d_tsz = cuda.to_device(self.template_sizes)
        d_loops = cuda.to_device(arr)
        d_len = cuda.to_device(lens)
        d_box = cuda.to_device(self.box)
        d_out = cuda.device_array((n_loops,3), dtype=np.float32)
        blocks, threads_per_block = get_cuda_launch_config(self.N)
        burgers_kernel[blocks, threads_per_block](
            d_pos, d_quat, d_pt,
            d_tpl, d_tsz,
            d_loops, d_len,
            d_box,
            d_out
        )
        res = d_out.copy_to_host()
        return {i:res[i] for i in range(n_loops)}
