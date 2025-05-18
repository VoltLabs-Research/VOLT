from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.utils.kernels import burgers_kernel
import numpy as np

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
