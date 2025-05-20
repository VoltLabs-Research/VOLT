from numba import cuda
import numpy as np
import math

def quaternion_to_matrix(quaternion):
    w, x, y, z = quaternion
    ww = w * w
    xx = x * x
    yy = y * y
    zz = z * z
    wx = w * x
    wy = w * y
    wz = w * z
    xy = x * y
    xz = x * z
    yz = y * z

    R = np.array([
        [ww + xx - yy - zz, 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), ww - xx + yy - zz, 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), ww - xx - yy + zz]
    ], dtype=np.float32)
    
    return R

@cuda.jit(device=True)
def pbc_distance2(xi, yi, zi, xj, yj, zj, lx, ly, lz):
    """
    Compute squared distance with periodic boundaries.
    """
    dx = xj - xi
    dy = yj - yi
    dz = zj - zi
    if dx >  0.5*lx: dx -= lx
    elif dx < -0.5*lx: dx += lx
    if dy >  0.5*ly: dy -= ly
    elif dy < -0.5*ly: dy += ly
    if dz >  0.5*lz: dz -= lz
    elif dz < -0.5*lz: dz += lz
    return dx*dx + dy*dy + dz*dz

def get_cuda_launch_config(items, threads_per_block=256, min_blocks_per_sm=16):
    device = cuda.get_current_device()
    sms = device.MULTIPROCESSOR_COUNT
    min_blocks = sms * min_blocks_per_sm
    data_blocks = math.ceil(items / threads_per_block)
    blocks = max(min_blocks, data_blocks)
    return blocks, threads_per_block