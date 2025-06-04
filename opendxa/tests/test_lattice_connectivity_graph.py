import numpy as np
import pytest
from opendxa.classification.connectivity import LatticeConnectivityGraph

def make_identity_quaternions(N):
    '''
    Return an (N,4) array of identity quaternions [1,0,0,0].
    '''
    q = np.zeros((N, 4), dtype=np.float32)
    q[:, 0] = 1.0
    return q

def make_zero_templates(M, Kmax):
    '''
    Return a (M, Kmax, 3) array of all zeros and a template_sizes array of length M,
    where each entry is K=Kmax.
    '''
    templates = np.zeros((M, Kmax, 3), dtype=np.float32)
    sizes = np.full((M,), Kmax, dtype=int)
    return templates, sizes

def test_constructor_invalid_ids_length():
    positions = np.zeros((3, 3), dtype=np.float32)
    ids = np.array([0, 1], dtype=int)  # length 2 != N=3
    neighbors = {0: [1], 1: [0], 2: []}
    types = np.zeros(3, dtype=int)
    quaternions = make_identity_quaternions(3)
    templates, template_sizes = make_zero_templates(M=1, Kmax=1)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'ids length must match positions' in str(exc.value)

def test_constructor_invalid_neighbors_keys():
    positions = np.zeros((2, 3), dtype=np.float32)
    ids = np.array([10, 20], dtype=int)
    # key '2' is out of range (N=2 → valid keys are 0,1)
    neighbors = {0: [1], 2: [0]}
    types = np.zeros(2, dtype=int)
    quaternions = make_identity_quaternions(2)
    templates, template_sizes = make_zero_templates(M=1, Kmax=1)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'neighbor key 2 out of range' in str(exc.value)

def test_constructor_invalid_neighbors_values():
    positions = np.zeros((2, 3), dtype=np.float32)
    ids = np.array([100, 200], dtype=int)
    # neighbor 5 is out of range for atom 0
    neighbors = {0: [5], 1: []}
    types = np.zeros(2, dtype=int)
    quaternions = make_identity_quaternions(2)
    templates, template_sizes = make_zero_templates(M=1, Kmax=1)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'neighbor 5 of atom 0 out of range' in str(exc.value)

def test_constructor_invalid_types_length():
    positions = np.zeros((2, 3), dtype=np.float32)
    ids = np.array([0, 1], dtype=int)
    neighbors = {0: [1], 1: [0]}
    types = np.array([0], dtype=int)  # length 1 != N=2
    quaternions = make_identity_quaternions(2)
    templates, template_sizes = make_zero_templates(M=1, Kmax=1)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'types length must match positions' in str(exc.value)

def test_constructor_invalid_quaternions_shape():
    positions = np.zeros((2, 3), dtype=np.float32)
    ids = np.array([0, 1], dtype=int)
    neighbors = {0: [1], 1: [0]}
    types = np.zeros(2, dtype=int)
    # wrong shape: (2,3) instead of (2,4)
    quaternions = np.zeros((2, 3), dtype=np.float32)
    templates, template_sizes = make_zero_templates(M=1, Kmax=1)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'quaternions must have shape (N,4)' in str(exc.value)

def test_constructor_invalid_template_sizes_length():
    positions = np.zeros((2, 3), dtype=np.float32)
    ids = np.array([0, 1], dtype=int)
    neighbors = {0: [1], 1: [0]}
    types = np.zeros(2, dtype=int)
    quaternions = make_identity_quaternions(2)
    # templates has M=2, but template_sizes has length 1
    templates = np.zeros((2, 1, 3), dtype=np.float32)
    template_sizes = np.array([1], dtype=int)

    with pytest.raises(ValueError) as exc:
        LatticeConnectivityGraph(
            positions, ids, neighbors,
            types, quaternions,
            templates, template_sizes,
            tolerance=0.2
        )
    assert 'template_sizes length must match number of templates' in str(exc.value)

def test_build_graph_two_atoms_match_exact_template():
    '''
    Two atoms at (0,0,0) and (1,0,0). Each type=0 uses a single-neighbor template
    T=[(1,0,0)] in its own local frame. With identity quaternion and scale=1,
    predicted neighbor=(1,0,0) for atom 0 and (0,0,0) for atom 1. 
    Using tolerance=0.2*scale=0.2, the match succeeds. Expect an edge 0<->1.
    '''
    positions = np.array([[0.0, 0.0, 0.0],
                          [1.0, 0.0, 0.0]], dtype=np.float32)
    ids = np.array([10, 11], dtype=int)
    neighbors = {0: [1], 1: [0]}
    types = np.array([0, 0], dtype=int)
    quaternions = make_identity_quaternions(2)

    # One template (M=1) of K=1 neighbor at local (1,0,0)
    templates = np.zeros((1, 1, 3), dtype=np.float32)
    templates[0, 0, :] = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    template_sizes = np.array([1], dtype=int)

    graph_builder = LatticeConnectivityGraph(
        positions, ids, neighbors,
        types, quaternions,
        templates, template_sizes,
        tolerance=0.2
    )

    graph = graph_builder.build_graph()
    # Both directions should appear
    assert graph[0] == [1]
    assert graph[1] == [0]

def test_build_graph_type_negative_skips():
    '''
    If type<0 (disordered), we skip that atom entirely even if neighbors exist.
    Example: types = [-1, 0], neighbors {1: [0]}.  With no valid prediction 
    within tolerance, the final graph remains empty for both.
    '''
    positions = np.array([[0.0, 0.0, 0.0],
                          [1.0, 0.0, 0.0]], dtype=np.float32)
    ids = np.array([5, 6], dtype=int)
    neighbors = {0: [], 1: [0]}
    types = np.array([-1, 0], dtype=int)
    quaternions = make_identity_quaternions(2)

    # One template for type=0
    templates = np.zeros((1, 1, 3), dtype=np.float32)
    templates[0, 0, :] = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    template_sizes = np.array([1], dtype=int)

    graph_builder = LatticeConnectivityGraph(
        positions, ids, neighbors,
        types, quaternions,
        templates, template_sizes,
        tolerance=0.2
    )

    graph = graph_builder.build_graph()
    # Atom 0 has type<0 → skip entirely. Atom 1ʼs predicted neighbor (2,0,0)
    # lies outside tolerance from (0,0,0) so no link. After symmetrization → no links.
    assert graph[0] == []
    assert graph[1] == []

if __name__ == '__main__':
    pytest.main([__file__])
