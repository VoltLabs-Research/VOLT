from opendxa.utils.burgers import compute_local_scales
from opendxa.classification.burgers import BurgersCircuitEvaluator
from numba import cuda

import numpy as np
import pytest
import logging

logging.getLogger('opendxa').setLevel(logging.WARNING)

def test_compute_local_scales_no_pbc():
    '''
    Two atoms at (0,0,0) and (3,0,0) with no box_bounds - average bond length = 3.0 for both.
    '''
    positions = np.array([[0.0, 0.0, 0.0], [3.0, 0.0, 0.0]], dtype=np.float32)
    connectivity = {
        # atom 0 connected to atom 1
        0: [1],
        # atom 1 connected to atom 0
        1: [0],
    }

    scales = compute_local_scales(positions, connectivity, box_bounds=None)
    assert scales.shape == (2,)
    assert pytest.approx(scales[0], rel=1e-6) == 3.0
    assert pytest.approx(scales[1], rel=1e-6) == 3.0

def test_compute_local_scales_with_pbc():
    '''
    Two atoms at (0,0,0) and (9,0,0) inside a box [0,10] along x.
    Without PBC distance is 9, but with PBC nearest distance is 1.
    Each scale should therefore be 1.0.
    '''
    positions = np.array([[0.0, 0.0, 0.0], [9.0, 0.0, 0.0]], dtype=np.float32)
    connectivity = {0: [1], 1: [0]}
    box_bounds = np.array([[0.0, 10.0], [0.0, 10.0], [0.0, 10.0]], dtype=np.float32)
    scales = compute_local_scales(positions, connectivity, box_bounds=box_bounds)
    assert scales.shape == (2,)
    # Under PBC, distance = 1.0
    assert pytest.approx(scales[0], rel=1e-6) == 1.0
    assert pytest.approx(scales[1], rel=1e-6) == 1.0

def test_compute_local_scales_isolated_atom():
    '''
    If an atom has no neighbors, scale defaults to 1.0.
    '''
    positions = np.array([[0.0, 0.0, 0.0], [5.0, 0.0, 0.0]], dtype=np.float32)
    connectivity = {0: [], 1: []}
    scales = compute_local_scales(positions, connectivity, box_bounds=None)
    assert scales.shape == (2,)
    assert scales[0] == 1.0
    assert scales[1] == 1.0

def test_burgers_no_loops_returns_empty():
    '''
    If BurgersCircuitEvaluator.loops is empty, calculate_burgers() should return {}.
    '''
    dummy_connectivity = {0: [], 1: []}
    positions = np.zeros((2, 3), dtype=np.float32)
    types = np.zeros(2, dtype=np.int32)
    quaternions = np.zeros((2, 4), dtype=np.float32)
    # M=1, Kmax=1
    templates = np.zeros((1, 1, 3), dtype=np.float32) 
    template_sizes = np.array([1], dtype=np.int32)

    evaluator = BurgersCircuitEvaluator(
        connectivity=dummy_connectivity,
        positions=positions,
        types=types,
        quaternions=quaternions,
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=None
    )
    assert evaluator.loops == []
    result = evaluator.calculate_burgers()
    # empty dict when no loops are present
    assert result == {}

@pytest.mark.skipif(not cuda.is_available(), reason="Requires CUDA")
def test_burgers_single_atom_loop_zero_vector():
    '''
    Single atom at origin with identity quaternion. We build a loop [0].
    Using a zero template, the kernel must output Burgers = [0,0,0].
    '''
    # Single atom
    connectivity = {0: []}
    positions = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)
    quaternions = np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32)  # identity
    types = np.array([0], dtype=np.int32)

    templates = np.zeros((1, 1, 3), dtype=np.float32)
    template_sizes = np.array([1], dtype=np.int32)

    evaluator = BurgersCircuitEvaluator(
        connectivity=connectivity,
        positions=positions,
        types=types,
        quaternions=quaternions,
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=None
    )

    # Single loop [0], the only segment is i=0 -> j=0; with template = [0,0,0], Burgers = [0,0,0]
    evaluator.loops = [[0]]
    result = evaluator.calculate_burgers()
    assert isinstance(result, dict)
    assert 0 in result

    bv = result[0]
    assert bv.shape == (3,)
    assert np.allclose(bv, np.zeros(3, dtype=np.float32), atol=1e-6)

@pytest.mark.skipif(not cuda.is_available(), reason="Requires CUDA")
def test_burgers_two_atom_loop_produces_minus_two_x():
    '''
    Two atoms at (0,0,0) and (1,0,0), both identity quaternion.
    Build a 2-atom loop [0,1]. The kernel logic yields Burgers = [-2,0,0].
    '''
    connectivity = {0: [1], 1: [0]}
    positions = np.array([[0.0, 0.0, 0.0],
                          [1.0, 0.0, 0.0]], dtype=np.float32)
    quaternions = np.array([[1.0, 0.0, 0.0, 0.0],
                             [1.0, 0.0, 0.0, 0.0]], dtype=np.float32)
    types = np.array([0, 0], dtype=np.int32)

    # Single template pointing along +x
    templates = np.zeros((1, 1, 3), dtype=np.float32)
    templates[0, 0, :] = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    template_sizes = np.array([1], dtype=np.int32)

    box_bounds = np.array([[0.0, 10.0],
                           [0.0, 10.0],
                           [0.0, 10.0]], dtype=np.float32)

    evaluator = BurgersCircuitEvaluator(
        connectivity=connectivity,
        positions=positions,
        types=types,
        quaternions=quaternions,
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=box_bounds
    )

    # Loop: [0 -> 1 -> 0].  Kernel's math yields Burgers = [-2, 0, 0].
    evaluator.loops = [[0, 1]]
    result = evaluator.calculate_burgers()
    assert isinstance(result, dict)
    assert 0 in result

    bv = result[0]
    assert bv.shape == (3,)
    # The kernel produces roughly [-2, 0, 0], check with a small tolerance:
    assert np.allclose(bv, np.array([-2.0, 0.0, 0.0], dtype=np.float32), atol=1e-5)
