from opendxa.kernels.line_classification import classify_line_kernel
from numba import cuda
import numpy as np
import pytest

@pytest.fixture(autouse=True)
def skip_if_no_cuda():
    if not cuda.is_available():
        pytest.skip('Skipping classify_line_kernel tests because CUDA is not available')

def launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers):
    num_loops = loops_arr.shape[0]

    dev_positions = cuda.to_device(positions.astype(np.float32))
    dev_loops_arr = cuda.to_device(loops_arr.astype(np.int32))
    dev_loop_lens = cuda.to_device(loop_lens.astype(np.int32))
    dev_burgers = cuda.to_device(burgers.astype(np.float32))
    dev_types_out = cuda.device_array(num_loops, dtype=np.int32)

    threads_per_block = 32
    blocks_per_grid = (num_loops + threads_per_block - 1) // threads_per_block

    classify_line_kernel[blocks_per_grid, threads_per_block](
        dev_positions,
        dev_loops_arr,
        dev_loop_lens,
        dev_burgers,
        dev_types_out
    )

    return dev_types_out.copy_to_host()

def test_classify_undefined_short_loop():
    '''
    Loop length < 2 should give type -1 regardless of burgers vector.
    '''
    positions = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)
    loops_arr = np.array([[0]], dtype=np.int32)
    loop_lens = np.array([1], dtype=np.int32)
    burgers = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)

    types_out = launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers)
    assert types_out[0] == -1

def test_classify_undefined_zero_burgers():
    '''
    Zero Burgers vector should result in type -1.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0]
    ], dtype=np.float32)
    loops_arr = np.array([[0, 1]], dtype=np.int32)
    loop_lens = np.array([2], dtype=np.int32)
    burgers = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)

    types_out = launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers)
    assert types_out[0] == -1

def test_classify_edge_dislocation():
    '''
    Burgers perpendicular to tangent (tangent along x, burgers along y) → edge (0).
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0]
    ], dtype=np.float32)
    loops_arr = np.array([[0, 1]], dtype=np.int32)
    loop_lens = np.array([2], dtype=np.int32)
    # Burgers vector along y
    burgers = np.array([[0.0, 1.0, 0.0]], dtype=np.float32)

    types_out = launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers)
    assert types_out[0] == 0

def test_classify_screw_dislocation():
    '''
    Burgers parallel to tangent (both along x) → screw (1).
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0]
    ], dtype=np.float32)
    loops_arr = np.array([[0, 1]], dtype=np.int32)
    loop_lens = np.array([2], dtype=np.int32)
    # Burgers vector along x
    burgers = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)

    types_out = launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers)
    assert types_out[0] == 1

def test_classify_mixed_dislocation():
    '''
    Burgers neither parallel nor perpendicular (angle ~45°) → mixed (2).
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0]
    ], dtype=np.float32)
    loops_arr = np.array([[0, 1]], dtype=np.int32)
    loop_lens = np.array([2], dtype=np.int32)
    # Burgers vector at 45° in xy-plane → [1,1,0], tangent along x → frac = 1/√2 ≈ 0.707 (between 0.2 and 0.8)
    burgers = np.array([[1.0, 1.0, 0.0]], dtype=np.float32)

    types_out = launch_classify_line_kernel(positions, loops_arr, loop_lens, burgers)
    assert types_out[0] == 2
