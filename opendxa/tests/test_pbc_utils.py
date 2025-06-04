import numpy as np
import pytest

from opendxa.utils.pbc import (
    unwrap_pbc_displacement,
    unwrap_pbc_positions,
    compute_minimum_image_distance,
    detect_pbc_from_box
)

def test_unwrap_pbc_displacement_positive_wrap():
    '''
    A displacement larger than half the box length should wrap back into the box.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    raw_displacement = np.array([9.0, 0.0, 0.0], dtype=np.float32)
    # Half the box length in x is 5.0, so 9.0 > 5.0 → unwrap to 9.0 - 10.0 = -1.0
    expected_unwrapped = np.array([-1.0, 0.0, 0.0], dtype=np.float32)
    result = unwrap_pbc_displacement(raw_displacement, box)
    assert np.allclose(result, expected_unwrapped), (
        f'Expected {expected_unwrapped}, got {result}'
    )

def test_unwrap_pbc_displacement_negative_wrap():
    '''
    A negative displacement beyond -half box length should wrap forward into the box.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    raw_displacement = np.array([-6.0, 0.0, 0.0], dtype=np.float32)
    # Half the box length in x is 5.0, so -6.0 <= -5.0 → unwrap to -6.0 + 10.0 = 4.0
    expected_unwrapped = np.array([4.0, 0.0, 0.0], dtype=np.float32)
    result = unwrap_pbc_displacement(raw_displacement, box)
    assert np.allclose(result, expected_unwrapped), (
        f'Expected {expected_unwrapped}, got {result}'
    )

def test_unwrap_pbc_displacement_no_wrap():
    '''
    A displacement within [-L/2, L/2] should remain unchanged.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    raw_displacement = np.array([2.0, -3.0, 4.0], dtype=np.float32)
    expected_unwrapped = raw_displacement.copy()
    result = unwrap_pbc_displacement(raw_displacement, box)
    assert np.allclose(result, expected_unwrapped), (
        f'Expected {expected_unwrapped}, got {result}'
    )

def test_unwrap_pbc_positions_with_reference():
    '''
    Given a reference position, any atom position differing by more than half
    the box length should be unwrapped accordingly.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    # Two atoms: one near the reference, one across the boundary
    positions = np.array([
        [1.0, 5.0, 5.0],
        [9.0, 5.0, 5.0]
    ], dtype=np.float32)
    reference_position = np.array([1.0, 5.0, 5.0], dtype=np.float32)
    # For the second atom: diff in x is 9 - 1 = 8 > 5 → unwrap x to 9 - 10 = -1
    expected_unwrapped = np.array([
        [1.0, 5.0, 5.0],
        [-1.0, 5.0, 5.0]
    ], dtype=np.float32)
    result = unwrap_pbc_positions(positions, box, reference_position)
    assert np.allclose(result, expected_unwrapped), (
        f'Expected\n{expected_unwrapped}\ngot\n{result}'
    )

def test_unwrap_pbc_positions_default_reference():
    '''
    If no reference position is provided, the mean of all positions is used.
    Verify that positions near the negative boundary unwrap correctly.
    '''
    box = np.array([[0.0, 8.0],
                    [0.0, 8.0],
                    [0.0, 8.0]], dtype=np.float32)
    # Three atoms roughly centered except one near low boundary in x
    positions = np.array([
        [0.2, 2.0, 2.0],
        [4.0, 2.0, 2.0],
        [4.0, 6.0, 2.0]
    ], dtype=np.float32)
    # Mean position is [ (0.2+4+4)/3,  (2+2+6)/3, 2 ] = [2.8, 3.33..., 2]
    # For first atom: diff in x = 0.2 - 2.8 = -2.6 <= -4.0? No, box_length/2 = 4.0, -2.6 > -4.0, so no unwrap.
    # Actually none unwrap in this scenario. We just check that the output equals input.
    expected_unwrapped = positions.copy()
    result = unwrap_pbc_positions(positions, box)
    assert np.allclose(result, expected_unwrapped), (
        f'Expected no change, got\n{result}'
    )

def test_compute_minimum_image_distance_no_wrap():
    '''
    If two positions are within half the box length, the direct vector is used.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    position1 = np.array([2.0, 2.0, 2.0], dtype=np.float32)
    position2 = np.array([4.0, 5.0, 2.0], dtype=np.float32)
    expected_vector = position2 - position1  # [2, 3, 0]
    expected_distance = np.linalg.norm(expected_vector)
    distance, vector = compute_minimum_image_distance(position1, position2, box)
    assert np.allclose(vector, expected_vector), (
        f'Expected vector {expected_vector}, got {vector}'
    )
    assert pytest.approx(distance) == expected_distance

def test_compute_minimum_image_distance_with_wrap():
    '''
    If two positions differ by more than half the box length along one axis,
    the vector should be wrapped through the periodic boundary.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    position1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    position2 = np.array([9.0, 0.0, 0.0], dtype=np.float32)
    # Raw difference in x = 8.0 > 5.0 → wrapped to 8.0 - 10.0 = -2.0
    expected_vector = np.array([-2.0, 0.0, 0.0], dtype=np.float32)
    expected_distance = np.linalg.norm(expected_vector)  # 2.0
    distance, vector = compute_minimum_image_distance(position1, position2, box)
    assert np.allclose(vector, expected_vector), (
        f'Expected vector {expected_vector}, got {vector}'
    )
    assert pytest.approx(distance) == expected_distance

def test_detect_pbc_from_box_true():
    '''
    If atoms are near both boundaries or span a large portion of the box,
    periodicity should be detected as True for that dimension.
    '''
    box = np.array([[0.0, 10.0],
                    [0.0, 10.0],
                    [0.0, 10.0]], dtype=np.float32)
    # Place atoms near x-min (0.05) and x-max (9.95), y-span small, z-span small
    positions = np.array([
        [0.05, 5.0, 5.0],
        [9.95, 5.0, 5.0],
        [5.0, 0.2, 5.0],
        [5.0, 9.8, 5.0],
        [5.0, 5.0, 0.5],
        [5.0, 5.0, 9.0]
    ], dtype=np.float32)
    # In x: near_min and near_max → True
    # In y: near_min and near_max → True
    # In z: neither near both, but span = 9.0 - 0.5 = 8.5, box_length = 10.0, span_ratio = 0.85 > 0.8 → True
    expected_pbc = (True, True, True)
    pbc_flags = detect_pbc_from_box(box, positions)
    assert pbc_flags == expected_pbc, f'Expected {expected_pbc}, got {pbc_flags}'

def test_detect_pbc_from_box_false():
    '''
    If atoms all lie well within the box and span less than 80% of the box,
    periodicity should be detected as False in each dimension.
    '''
    box = np.array([[0.0, 20.0],
                    [0.0, 20.0],
                    [0.0, 20.0]], dtype=np.float32)
    positions = np.array([
        [5.0,  5.0,  5.0],
        [8.0,  6.0,  5.5],
        [10.0, 7.0,  6.0],
        [12.0, 8.0,  7.0]
    ], dtype=np.float32)
    # In each dimension:
    #  - near_min = False (all coords > 0.1)
    #  - near_max = False (all coords < 19.9)
    #  - span ratio < 0.8
    expected_pbc = (False, False, False)
    pbc_flags = detect_pbc_from_box(box, positions)
    assert pbc_flags == expected_pbc, f'Expected {expected_pbc}, got {pbc_flags}'
