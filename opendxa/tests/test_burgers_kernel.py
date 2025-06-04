from opendxa.kernels.burgers import burgers_kernel
from numba import cuda
import numpy as np
import pytest

@pytest.fixture(autouse=True)
def skip_if_no_cuda():
    if not cuda.is_available():
        pytest.skip('Skipping Burgers kernel tests because CUDA is not available')

def launch_burgers_kernel(
    host_positions,
    host_quaternions,
    host_types,
    host_templates,
    host_template_sizes,
    host_loops,
    host_loop_lengths,
    host_box_bounds,
    host_local_scales
):
    num_loops = host_loops.shape[0]
    max_loop_length = host_loops.shape[1]

    # Allocate device arrays
    dev_positions = cuda.to_device(host_positions.astype(np.float32))
    dev_quaternions = cuda.to_device(host_quaternions.astype(np.float32))
    dev_types = cuda.to_device(host_types.astype(np.int32))
    dev_templates = cuda.to_device(host_templates.astype(np.float32))
    dev_template_sizes = cuda.to_device(host_template_sizes.astype(np.int32))
    dev_loops = cuda.to_device(host_loops.astype(np.int32))
    dev_loop_lengths = cuda.to_device(host_loop_lengths.astype(np.int32))
    dev_box_bounds = cuda.to_device(host_box_bounds.astype(np.float32))
    dev_local_scales = cuda.to_device(host_local_scales.astype(np.float32))

    dev_burgers_out = cuda.device_array((num_loops, 3), dtype=np.float32)

    threads_per_block = 32
    blocks_per_grid = (num_loops + threads_per_block - 1) // threads_per_block

    burgers_kernel[blocks_per_grid, threads_per_block](
        dev_positions,
        dev_quaternions,
        dev_types,
        dev_templates,
        dev_template_sizes,
        dev_loops,
        dev_loop_lengths,
        dev_box_bounds,
        dev_local_scales,
        dev_burgers_out
    )

    return dev_burgers_out.copy_to_host()

def test_burgers_kernel_single_loop_single_atom():
    '''
    A single loop containing one atom (i->i). The template neighbor is at the same position,
    so the Burgers vector should be zero.
    '''
    positions = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)
    quaternions = np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32)
    types = np.array([0], dtype=np.int32)

    templates = np.array([[[0.0, 0.0, 0.0]]], dtype=np.float32)
    template_sizes = np.array([1], dtype=np.int32)

    loops = np.array([[0]], dtype=np.int32)
    loop_lengths = np.array([1], dtype=np.int32)

    box_bounds = np.array([
        [-10.0, 10.0],
        [-10.0, 10.0],
        [-10.0, 10.0]
    ], dtype=np.float32)

    local_scales = np.array([1.0], dtype=np.float32)

    burgers_out = launch_burgers_kernel(
        positions,
        quaternions,
        types,
        templates,
        template_sizes,
        loops,
        loop_lengths,
        box_bounds,
        local_scales
    )

    expected = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)
    assert np.allclose(burgers_out, expected), (
        f'Expected zero Burgers vector, got {burgers_out}'
    )

def test_burgers_kernel_two_atom_loop_expected_displacement():
    '''
    Two-atom loop: atom0->atom1 and atom1->atom0. Using the given template [1,0,0]
    results in a net Burgers vector of [-2, 0, 0] rather than zero, since the second
    segment does not wrap in these box bounds.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0]
    ], dtype=np.float32)
    quaternions = np.array([
        [1.0, 0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0, 0.0]
    ], dtype=np.float32)
    types = np.array([0, 0], dtype=np.int32)

    templates = np.array([[[1.0, 0.0, 0.0]]], dtype=np.float32)
    template_sizes = np.array([1], dtype=np.int32)

    loops = np.array([[0, 1]], dtype=np.int32)
    loop_lengths = np.array([2], dtype=np.int32)

    box_bounds = np.array([
        [-10.0, 10.0],
        [-10.0, 10.0],
        [-10.0, 10.0]
    ], dtype=np.float32)

    local_scales = np.array([1.0, 1.0], dtype=np.float32)

    burgers_out = launch_burgers_kernel(
        positions,
        quaternions,
        types,
        templates,
        template_sizes,
        loops,
        loop_lengths,
        box_bounds,
        local_scales
    )

    expected = np.array([[-2.0, 0.0, 0.0]], dtype=np.float32)
    assert np.allclose(burgers_out, expected), (
        f'Expected Burgers vector [-2, 0, 0] for two-atom loop, got {burgers_out}'
    )
