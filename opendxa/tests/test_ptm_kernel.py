from opendxa.kernels.ptm import ptm_kernel
from numba import cuda
import numpy as np
import pytest

@pytest.fixture(autouse=True)
def skip_if_no_cuda():
    if not cuda.is_available():
        pytest.skip('Skipping PTM kernel tests because CUDA is not available')

def launch_ptm_kernel(
    host_positions,
    host_neighbors,
    host_box_bounds,
    host_templates,
    host_template_sizes,
    num_templates,
    max_neighbors
):
    num_atoms = host_positions.shape[0]

    # Allocate device arrays
    dev_positions = cuda.to_device(host_positions.astype(np.float32))
    dev_neighbors = cuda.to_device(host_neighbors.astype(np.int32))
    dev_box_bounds = cuda.to_device(host_box_bounds.astype(np.float32))
    dev_templates = cuda.to_device(host_templates.astype(np.float32))
    dev_template_sizes = cuda.to_device(host_template_sizes.astype(np.int32))

    dev_out_types = cuda.device_array(num_atoms, dtype=np.int32)
    dev_out_quaternion = cuda.device_array((num_atoms, 4), dtype=np.float32)

    threads_per_block = 32
    blocks_per_grid = (num_atoms + threads_per_block - 1) // threads_per_block

    ptm_kernel[blocks_per_grid, threads_per_block](
        dev_positions,
        dev_neighbors,
        dev_box_bounds,
        dev_templates,
        dev_template_sizes,
        num_templates,
        max_neighbors,
        dev_out_types,
        dev_out_quaternion
    )

    result_types = dev_out_types.copy_to_host()
    result_quaternions = dev_out_quaternion.copy_to_host()
    return result_types, result_quaternions

def test_ptm_kernel_no_neighbors():
    '''
    If an atom has no neighbors (neighbors array filled with -1),
    out_types should be -1 and out_quaternion zeros.
    '''
    num_atoms = 2
    max_neighbors = 4
    num_templates = 1

    # Positions arbitrary (2 atoms)
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 1.0, 1.0]
    ], dtype=np.float32)

    # Neighbors all -1 indicates no neighbors
    neighbors = np.full((num_atoms, max_neighbors), -1, dtype=np.int32)

    # Box bounds arbitrary
    box_bounds = np.array([
        [0.0, 10.0],
        [0.0, 10.0],
        [0.0, 10.0]
    ], dtype=np.float32)

    # Templates not used because Ni == 0 for all atoms
    templates = np.zeros((num_templates, max_neighbors, 3), dtype=np.float32)
    template_sizes = np.array([max_neighbors], dtype=np.int32)

    types_out, quaternions_out = launch_ptm_kernel(
        positions,
        neighbors,
        box_bounds,
        templates,
        template_sizes,
        num_templates,
        max_neighbors
    )

    # Both atoms have no neighbors → types == -1, quaternions == [0,0,0,0]
    assert np.all(types_out == -1), f'Expected all types -1, got {types_out}'
    assert np.allclose(quaternions_out, 0.0), (
        f'Expected all quaternions zero, got\n{quaternions_out}'
    )

def test_ptm_kernel_two_neighbors_template_match():
    '''
    For atom 0 with two neighbors at [1,0,0] and [0,1,0], and a matching template
    with the same neighbor pattern, RMSD is zero → out_types[0] == 0,
    out_quaternion[0] ≈ [1, 0, 0, 0]. Other atoms have no neighbors → type == -1.
    '''
    # Define 3 atoms: atom0 at origin, atom1 at (1,0,0), atom2 at (0,1,0)
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0]
    ], dtype=np.float32)
    num_atoms = positions.shape[0]

    max_neighbors = 2
    num_templates = 1

    # Neighbors: for atom0 → [1, 2]; for atoms 1 and 2 → no neighbors
    neighbors = np.full((num_atoms, max_neighbors), -1, dtype=np.int32)
    neighbors[0, 0] = 1
    neighbors[0, 1] = 2

    # Box bounds large enough to avoid PBC effects
    box_bounds = np.array([
        [-5.0, 5.0],
        [-5.0, 5.0],
        [-5.0, 5.0]
    ], dtype=np.float32)

    # One template with two neighbor vectors: [1,0,0], [0,1,0]
    templates = np.zeros((num_templates, max_neighbors, 3), dtype=np.float32)
    templates[0, 0, :] = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    templates[0, 1, :] = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    template_sizes = np.array([2], dtype=np.int32)

    types_out, quaternions_out = launch_ptm_kernel(
        positions,
        neighbors,
        box_bounds,
        templates,
        template_sizes,
        num_templates,
        max_neighbors
    )

    # Atom0 should match template0 → type == 0
    assert types_out[0] == 0, f'Expected type 0 for atom 0, got {types_out[0]}'
    # Atoms 1 and 2 have no neighbors → type == -1
    assert types_out[1] == -1, f'Expected type -1 for atom 1, got {types_out[1]}'
    assert types_out[2] == -1, f'Expected type -1 for atom 2, got {types_out[2]}'

    # Quaternion for zero rotation is approximately [1, 0, 0, 0]
    quat0 = quaternions_out[0]
    norm_quat = np.linalg.norm(quat0)
    assert pytest.approx(norm_quat, rel=1e-3) == 1.0, f'Expected unit quaternion, got norm {norm_quat}'
    assert quat0[0] > 0.9, f'Expected scalar part ~1, got {quat0[0]}'
    assert np.allclose(quat0[1:], 0.0, atol=1e-3), f'Expected vector part near zero, got {quat0[1:]}'
