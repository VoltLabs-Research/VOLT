from opendxa.classification.elastic_mapper import ElasticMapper, EnhancedElasticMapper, InterfaceMeshBuilder
import numpy as np

def test_compute_edge_vectors_without_pbc():
    '''
    Compute edge vectors for a simple connectivity without PBC.
    '''
    # Define positions for 3 atoms in a line
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [2.0, 0.0, 0.0]
    ], dtype=np.float64)

    # Connectivity: edges (0,1) and (1,2)
    connectivity = {
        0: {1},
        1: {0, 2},
        2: {1}
    }

    mapper = ElasticMapper(crystal_type='fcc', lattice_parameter=1.0, box_bounds=None, pbc=[False, False, False])
    edge_vectors = mapper.compute_edge_vectors(connectivity, positions)

    # Expect vector (1,0,0) for both edges
    expected_01 = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    expected_12 = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    assert np.allclose(edge_vectors[(0, 1)], expected_01)
    assert np.allclose(edge_vectors[(1, 2)], expected_12)

def test_compute_edge_vectors_with_pbc():
    '''
    Compute edge vectors with PBC where one atom crosses the boundary.
    '''
    # Box from 0 to 3 in x; atoms at x=0 and x=2.5 are near opposite faces
    positions = np.array([
        [0.0, 0.0, 0.0],
        [2.5, 0.0, 0.0]
    ], dtype=np.float64)

    connectivity = {0: {1}, 1: {0}}
    box_bounds = np.array([
        [0.0, 3.0],
        [0.0, 3.0],
        [0.0, 3.0]
    ], dtype=np.float64)

    mapper = ElasticMapper(crystal_type='fcc', lattice_parameter=1.0, box_bounds=box_bounds, pbc=[True, True, True])
    edge_vectors = mapper.compute_edge_vectors(connectivity, positions)

    # Direct difference is [2.5,0,0], but with PBC half-length is 1.5 → unwrap to [ -0.5, 0, 0 ]
    expected_vector = np.array([-0.5, 0.0, 0.0], dtype=np.float64)
    assert np.allclose(edge_vectors[(0, 1)], expected_vector)

def test_map_edge_burgers_small_displacements():
    '''
    Map a few small displacement jumps to ideal burgers vectors without GPU.
    '''
    # Create an ElasticMapper with lattice parameter 1.0 and tolerance 0.6
    mapper = ElasticMapper(crystal_type='fcc', lattice_parameter=1.0, tolerance=0.6, box_bounds=None)

    # Construct a displacement field where one edge displacement is exactly an ideal vector
    # For FCC perfect, ideal vector [0.5, 0.5, 0]
    edge_vectors = { (0, 1): None }
    displacement_field = { 0: np.array([0.0, 0.0, 0.0]), 1: np.array([0.5, 0.5, 0.0]) }

    mapped_burgers = mapper.map_edge_burgers({(0, 1): None}, displacement_field)

    # Expect perfect burger [0.5, 0.5, 0.0]
    expected = np.array([0.5, 0.5, 0.0], dtype=np.float64)
    assert (0, 1) in mapped_burgers
    assert np.allclose(mapped_burgers[(0, 1)], expected)

def test_map_edge_burgers_unmapped_when_too_far():
    '''
    If displacement jump is beyond tolerance, it remains unmapped.
    '''
    mapper = ElasticMapper(crystal_type='fcc', lattice_parameter=1.0, tolerance=0.1, box_bounds=None)

    # Displacement jump [1.0, 1.0, 0] is far from any ideal
    displacement_field = { 0: np.zeros(3), 1: np.array([1.0, 1.0, 0.0]) }
    mapped_burgers = mapper.map_edge_burgers({(0, 1): None}, displacement_field)

    # Should return the raw displacement as unmapped
    expected = np.array([1.0, 1.0, 0.0], dtype=np.float64)
    assert np.allclose(mapped_burgers[(0, 1)], expected)

def test_enhanced_elastic_mapper_intra_and_inter_cluster():
    '''
    Test EnhancedElasticMapper computes ideal edge vectors for intra- and inter-cluster edges.
    '''
    # Define simple positions for 4 atoms forming two clusters: {0,1} and {2,3}
    positions = np.array([
        [0.0, 0.0, 0.0],  # atom 0
        [1.0, 0.0, 0.0],  # atom 1
        [0.0, 1.0, 0.0],  # atom 2
        [1.0, 1.0, 0.0]   # atom 3
    ], dtype=np.float64)

    clusters = {0: [0, 1], 1: [2, 3]}
    cluster_transitions = {}  # not used in current implementation
    crystal_type = 'fcc'
    lattice_param = 1.0
    box_bounds = None

    enhanced_mapper = EnhancedElasticMapper(
        positions=positions,
        clusters=clusters,
        cluster_transitions=cluster_transitions,
        crystal_type=crystal_type,
        lattice_parameter=lattice_param,
        box_bounds=box_bounds
    )

    # Edges: intra within cluster 0: (0,1); intra within cluster 1: (2,3);
    # inter between clusters: (1,2)
    edges = [(0, 1), (2, 3), (1, 2)]
    tetrahedra = []  # not needed for this test

    ideal_vectors = enhanced_mapper.compute_ideal_edge_vectors(edges, tetrahedra)

    # For intra edges (0,1): actual vector is [1,0,0], which is a perfect FCC ideal → should map to close [0.5,0.5,0] or raw if tolerance too small.
    # Since tolerance defaults to 0.3, [1,0,0] is farther than 0.3 from any perfect FCC → fallback to raw vector
    expected_01 = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    assert np.allclose(ideal_vectors[(0, 1)], expected_01)

    # Intra cluster 1: (2,3) has actual [1,0,0]
    expected_23 = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    assert np.allclose(ideal_vectors[(2, 3)], expected_23)

    # Inter cluster (1,2): fallback to raw [ -1, 1, 0 ]
    actual_12 = positions[2] - positions[1]  # [-1, 1, 0]
    expected_12 = np.array([-1.0, 1.0, 0.0], dtype=np.float64)
    assert np.allclose(ideal_vectors[(1, 2)], expected_12)

def test_interface_mesh_builder_simple_interface():
    '''
    Construct two tetrahedra sharing a face: one good, one bad, test interface face detection.
    '''
    # Define 5 points in space
    positions = np.array([
        [0.0, 0.0, 0.0],  # 0
        [1.0, 0.0, 0.0],  # 1
        [0.0, 1.0, 0.0],  # 2
        [0.0, 0.0, 1.0],  # 3
        [1.0, 1.0, 1.0]   # 4
    ], dtype=np.float64)

    # Two tetrahedra sharing face (0,1,2):
    # Tet0: [0,1,2,3] (good), Tet1: [0,1,2,4] (bad)
    tetrahedra = np.array([
        [0, 1, 2, 3],
        [0, 1, 2, 4]
    ], dtype=np.int32)

    # Define ideal edge vectors so that Tet0 is good, Tet1 is bad.
    # Edges of Tet0: all pair differences match ideal vectors exactly.
    ideal_edge_vectors = {
        tuple(sorted((0, 1))): positions[1] - positions[0],
        tuple(sorted((0, 2))): positions[2] - positions[0],
        tuple(sorted((0, 3))): positions[3] - positions[0],
        tuple(sorted((1, 2))): positions[2] - positions[1],
        tuple(sorted((1, 3))): positions[3] - positions[1],
        tuple(sorted((2, 3))): positions[3] - positions[2],
        # No definitions for edges involving node 4 → Tet1 is bad
    }

    builder = InterfaceMeshBuilder(
        positions=positions,
        tetrahedra=tetrahedra,
        ideal_edge_vectors=ideal_edge_vectors,
        defect_threshold=0.1
    )

    result = builder.build_interface_mesh()
    interface_faces = result['faces']
    vertices = result['vertices']
    classification = result['tetrahedra_classification']

    # Tet0 index 0 is good, Tet1 index 1 is bad
    assert classification[0] is True
    assert classification[1] is False

    # The shared face (0,1,2) should appear as interface
    sorted_face = sorted((0, 1, 2))
    # Remap sorted_face to local indices in vertices
    local_indices = [np.where((vertices == positions[v]).all(axis=1))[0][0] for v in sorted_face]
    # Check that one of the faces in result['faces'] matches local_indices (any order)
    assert any(set(face) == set(local_indices) for face in interface_faces)

def test_interface_mesh_builder_no_interface_when_all_good():
    '''
    If all tetrahedra are classified as good, interface should be empty.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)

    # Single tetrahedron → trivially good if all edges in ideal_edge_vectors
    tetrahedra = np.array([[0, 1, 2, 3]], dtype=np.int32)
    ideal_edge_vectors = {
        (0, 1): positions[1] - positions[0],
        (0, 2): positions[2] - positions[0],
        (0, 3): positions[3] - positions[0],
        (1, 2): positions[2] - positions[1],
        (1, 3): positions[3] - positions[1],
        (2, 3): positions[3] - positions[2]
    }

    builder = InterfaceMeshBuilder(
        positions=positions,
        tetrahedra=tetrahedra,
        ideal_edge_vectors=ideal_edge_vectors,
        defect_threshold=0.1
    )

    result = builder.build_interface_mesh()
    assert result['faces'].size == 0
    assert result['vertices'].size == 0
    assert all(result['tetrahedra_classification'].values())
