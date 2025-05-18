from numba import cuda
from opendxa.utils.cuda import get_cuda_launch_config
from opendxa.utils.kernels import classify_line_kernel
import numpy as np

class ClassificationEngine:
    """
    Encapsulates dislocation classification (edge, screw, mixed).
    """
    def __init__(
        self, positions, loops, burgers_vectors,
    ):
        self.positions = np.asarray(positions, dtype=np.float32)
        # loops: list of variable-length loops
        self.M = len(loops)
        self.loop_lens = np.array([len(lp) for lp in loops], dtype=np.int32)
        max_len = max(self.loop_lens) if self.M > 0 else 0
        loops_arr = -np.ones((self.M, max_len), dtype=np.int32)
        for i, lp in enumerate(loops):
            for j, idx_atom in enumerate(lp):
                loops_arr[i, j] = idx_atom
        self.loops_arr = loops_arr
        # Burgers vectors
        self.burgers = np.array(
            [burgers_vectors[i] for i in range(self.M)],
            dtype=np.float32
        )
        # output array
        self.types = np.full(self.M, -1, dtype=np.int32)

    def classify(self):
        d_pos = cuda.to_device(self.positions)
        d_loops = cuda.to_device(self.loops_arr)
        d_lens = cuda.to_device(self.loop_lens)
        d_burg = cuda.to_device(self.burgers)
        d_out  = cuda.device_array(self.M, dtype=np.int32)
        # TODO: DUPLICATED CODE!
        threads_per_block = 256
        blocks, threads_per_block = get_cuda_launch_config(self.M)
        classify_line_kernel[blocks, threads_per_block](
            d_pos, d_loops, d_lens, d_burg, d_out
        )
        self.types = d_out.copy_to_host()
        return self.types