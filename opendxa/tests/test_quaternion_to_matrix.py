from scipy.spatial.transform import Rotation as ScipyRotation
from opendxa.utils.cuda import quaternion_to_matrix
import numpy as np
import pytest

def is_close(matrix_a, matrix_b, tolerance=1e-6):
    return np.allclose(matrix_a, matrix_b, atol=tolerance)

def test_quaternion_identity():
    '''
    A unit quaternion [1, 0, 0, 0] should produce the 3x3 identity matrix.
    '''
    unit_quaternion = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    expected_matrix = np.eye(3, dtype=np.float32)
    result_matrix = quaternion_to_matrix(unit_quaternion)
    assert is_close(result_matrix, expected_matrix), (
        f'Expected identity matrix, but got:\n{result_matrix}'
    )

@pytest.mark.parametrize(
    'rotation_axis, rotation_angle_rad, expected_matrix',
    [
        # 180° rotation around X axis -> diag(1, -1, -1)
        (
            np.array([1.0, 0.0, 0.0]),
            np.pi,
            np.array(
                [
                    [1.0,  0.0,  0.0],
                    [0.0, -1.0,  0.0],
                    [0.0,  0.0, -1.0]
                ],
                dtype=np.float32
            )
        ),
        # 180° rotation around Y axis -> diag(-1, 1, -1)
        (
            np.array([0.0, 1.0, 0.0]),
            np.pi,
            np.array(
                [
                    [-1.0,  0.0,  0.0],
                    [ 0.0,  1.0,  0.0],
                    [ 0.0,  0.0, -1.0]
                ],
                dtype=np.float32
            )
        ),
        # 180° rotation around Z axis -> diag(-1, -1, 1)
        (
            np.array([0.0, 0.0, 1.0]),
            np.pi,
            np.array(
                [
                    [-1.0,  0.0,  0.0],
                    [ 0.0, -1.0,  0.0],
                    [ 0.0,  0.0,  1.0]
                ],
                dtype=np.float32
            )
        ),
    ]
)
def test_quaternion_180_degrees(rotation_axis, rotation_angle_rad, expected_matrix):
    '''
    Verify that a quaternion encoding a 180° rotation around a given axis
    produces the correct rotation matrix.
    '''
    normalized_axis = rotation_axis / np.linalg.norm(rotation_axis)
    half_angle = rotation_angle_rad / 2.0
    w_component = np.cos(half_angle)
    x_component, y_component, z_component = normalized_axis * np.sin(half_angle)
    test_quaternion = np.array(
        [w_component, x_component, y_component, z_component],
        dtype=np.float32
    )

    result_matrix = quaternion_to_matrix(test_quaternion)
    assert is_close(result_matrix, expected_matrix), (
        f'180° rotation around axis {rotation_axis}:\n'
        f'Expected:\n{expected_matrix}\nGot:\n{result_matrix}'
    )

def test_quaternion_random_check():
    '''
    Random check: construct a reference rotation matrix using scipy,
    then verify that quaternion_to_matrix(quaternion) matches that matrix.
    '''
    random_axis = np.array([0.2, -0.5, 0.8], dtype=np.float32)
    normalized_random_axis = random_axis / np.linalg.norm(random_axis)
    # radians
    random_angle = 1.234

    # Obtain quaternion from scipy (scipy returns [x, y, z, w])
    scipy_rot = ScipyRotation.from_rotvec(normalized_random_axis * random_angle)
    scipy_quat_xyzw = scipy_rot.as_quat()
    test_quaternion = np.array(
        [scipy_quat_xyzw[3], scipy_quat_xyzw[0], scipy_quat_xyzw[1], scipy_quat_xyzw[2]],
        dtype=np.float32
    )

    expected_matrix = scipy_rot.as_matrix().astype(np.float32)
    result_matrix = quaternion_to_matrix(test_quaternion)
    assert is_close(result_matrix, expected_matrix), (
        f'Expected (from scipy):\n{expected_matrix}\nGot:\n{result_matrix}'
    )
