from numba import cuda
from opendxa.classification.cna import CNALocalClassifier
import pytest
import numpy as np

import logging

logging.getLogger('opendxa').setLevel(logging.WARNING)

@pytest.fixture
def dummy_data():
    '''
    Provides minimal data to instantiate CNALocalClassifier:
    - positions: 5 random 3D points.
    - box_bounds: cubic box [0,10]^3.
    - neighbor_dict: atom 0 has neighbors [1,2], atom 3 has neighbor [4], rest empty.
    - cutoff_distance, tolerance, adaptive_cutoff, neighbor_tolerance: arbitrary floats.
    - max_neighbors: set to 4.
    '''
    N = 5
    positions = np.random.rand(N, 3).astype(np.float32)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float32)
    neighbor_dict = {
        0: [1, 2],
        1: [],
        2: [],
        3: [4],
        4: []
    }
    cutoff_distance = np.float32(1.5)
    tolerance = np.float32(0.1)
    adaptive_cutoff = np.float32(0.0)
    neighbor_tolerance = np.float32(0.2)
    max_neighbors = 4
    return (
        positions, 
        box_bounds, 
        neighbor_dict,
        cutoff_distance, 
        max_neighbors,
        tolerance, 
        adaptive_cutoff, 
        neighbor_tolerance
    )

def test_neighbors_matrix_filling(dummy_data):
    '''
    Verify that the internal self.neighbors array is filled correctly:
    - Atom 0: [1,2,-1,-1]
    - Atom 3: [4,-1,-1,-1]
    - Atom 1 and 2 and 4: all -1.
    '''
    classifier = CNALocalClassifier(*dummy_data)
    neighbors_matrix = classifier.neighbors

    # Atom 0: first two entries should be 1, 2; then -1
    assert neighbors_matrix[0, 0] == 1
    assert neighbors_matrix[0, 1] == 2
    assert neighbors_matrix[0, 2] == -1
    assert neighbors_matrix[0, 3] == -1

    # Atom 3: first entry 4, rest -1
    assert neighbors_matrix[3, 0] == 4
    assert neighbors_matrix[3, 1] == -1
    assert neighbors_matrix[3, 2] == -1
    assert neighbors_matrix[3, 3] == -1

    # Atoms 1,2,4: all entries -1
    assert np.all(neighbors_matrix[1] == -1)
    assert np.all(neighbors_matrix[2] == -1)
    assert np.all(neighbors_matrix[4] == -1)

def test_infer_structure_type_manual_assignment(dummy_data):
    '''
    Manually set classifier.types to [0,0,1,0,2], then:
    - structure_names[0] = 'FCC', so result 'FCC'
    - fraction = 3/5
    - counts {0:3, 1:1, 2:1}
    '''
    classifier = CNALocalClassifier(*dummy_data)

    # Attach structure_names mapping
    classifier.structure_names = classifier.get_structure_names()

    classifier.types = np.array([0, 0, 1, 0, 2], dtype=np.int32)
    classifier.cna_signatures = np.zeros((5, 6), dtype=np.int32)

    structure_name, fraction, counts = classifier.infer_structure_type()
    assert structure_name == 'FCC'
    assert pytest.approx(fraction, rel=1e-6) == 3 / 5
    assert counts == {0: 3, 1: 1, 2: 1}

def test_infer_structure_type_no_valid(dummy_data):
    '''
    If all classifier.types == -1, then:
    - structure_name is None
    - fraction == 0.0
    - counts == {-1:5}
    '''
    classifier = CNALocalClassifier(*dummy_data)

    classifier.structure_names = classifier.get_structure_names()
    classifier.types = np.full((5,), -1, dtype=np.int32)
    classifier.cna_signatures = np.zeros((5, 6), dtype=np.int32)

    structure_name, fraction, counts = classifier.infer_structure_type()
    assert structure_name is None
    assert fraction == 0.0
    assert counts == {-1: 5}

def test_infer_structure_type_unknown_key(dummy_data):
    '''
    If classifier.types contains a key not in structure_names (e.g., 7),
    infer_structure_type returns 'Unknown' with fraction=1.0 and counts={7:5}.
    '''
    classifier = CNALocalClassifier(*dummy_data)

    classifier.structure_names = classifier.get_structure_names()
    classifier.types = np.array([7, 7, 7, 7, 7], dtype=np.int32)
    classifier.cna_signatures = np.zeros((5, 6), dtype=np.int32)

    structure_name, fraction, counts = classifier.infer_structure_type()
    assert structure_name == 'Unknown'
    assert pytest.approx(fraction, rel=1e-6) == 1.0
    assert counts == {7: 5}

@pytest.mark.skipif(not cuda.is_available(), reason='Requires CUDA-enabled GPU')
def test_classify_integration_extended(dummy_data):
    '''
    Invoke classify() with extended_signatures=True.
    Verify that:
    - types_out shape == (5,)
    - cna_signatures shape == (5, 6)
    '''
    classifier = CNALocalClassifier(*dummy_data)

    types_out, signatures_out = classifier.classify()
    assert isinstance(types_out, np.ndarray)
    assert types_out.shape == (5,)
    assert types_out.dtype == np.int32

    assert isinstance(signatures_out, np.ndarray)
    assert signatures_out.shape == (5, 6)
    assert signatures_out.dtype == np.int32

@pytest.mark.skipif(not cuda.is_available(), reason='Requires CUDA-enabled GPU')
def test_classify_compatible_standard(dummy_data):
    '''
    Invoke classify_compatible() (which forces extended_signatures=False).
    Verify that:
    - types_out shape == (5,)
    - cna_signatures shape == (5, 4)
    '''
    classifier = CNALocalClassifier(*dummy_data)

    types_out, signatures_out = classifier.classify_compatible()
    assert isinstance(types_out, np.ndarray)
    assert types_out.shape == (5,)
    assert types_out.dtype == np.int32

    assert isinstance(signatures_out, np.ndarray)
    assert signatures_out.shape == (5, 4)
    assert signatures_out.dtype == np.int32

if __name__ == '__main__':
    pytest.main([__file__])
