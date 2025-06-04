from opendxa.classification.ptm import PTMLocalClassifier

import numpy as np
import pytest
import logging

logging.getLogger('opendxa').setLevel(logging.WARNING)

@pytest.fixture
def dummy_data():
    '''
    Provides minimal data to instantiate PTMLocalClassifier:
    - positions: 5 random atom positions.
    - box_bounds: cubic box [0,10]^3.
    - neighbor_dict: initially empty lists for all atoms.
    - templates: shape (1,1,4) so ptm_kernel can index templates[0,0,0..3].
    - template_sizes: array with single element 1.
    '''
    N = 5
    positions = np.random.rand(N, 3).astype(np.float32)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float32)
    neighbor_dict = {i: [] for i in range(N)}
    templates = np.zeros((1, 1, 4), dtype=np.float32)
    template_sizes = np.array([1], dtype=np.int32)
    return positions, box_bounds, neighbor_dict, templates, template_sizes

def test_neighbors_matrix_filling(dummy_data):
    '''
    Verify that, given a neighbor_dict with specific neighbors,
    the internal self.neighbors array is filled correctly and -1 elsewhere.
    '''
    positions, box_bounds, _, templates, template_sizes = dummy_data
    
    # Create a neighbor_dict where atom 0 has neighbors [1,2], atom 3 has neighbor [4]
    custom_neighbor_dict = {
        0: [1, 2],
        1: [],
        2: [],
        3: [4],
        4: []
    }

    classifier = PTMLocalClassifier(
        positions=positions,
        box_bounds=box_bounds,
        neighbor_dict=custom_neighbor_dict,
        templates=templates,
        template_sizes=template_sizes,
        max_neighbors=4
    )

    # Retrieve the internal neighbors matrix
    neighbors_matrix = classifier.neighbors
    
    # Atom 0: first two entries should be 1,2; the rest -1
    assert neighbors_matrix[0, 0] == 1
    assert neighbors_matrix[0, 1] == 2
    assert neighbors_matrix[0, 2] == -1
    assert neighbors_matrix[0, 3] == -1
    
    # Atom 3: first entry should be 4; the rest -1
    assert neighbors_matrix[3, 0] == 4
    assert neighbors_matrix[3, 1] == -1
    assert neighbors_matrix[3, 2] == -1
    assert neighbors_matrix[3, 3] == -1

    # Any atom not in the dict (but all are) should be -1 row; we check atom 1:
    assert np.all(neighbors_matrix[1] == -1)

def test_infer_structure_type_unknown_key(dummy_data):
    '''
    If self.types contains a value not in structure_names (e.g., 5),
    infer_structure_type should return 'Unknown' as the structure name.
    '''
    positions, box_bounds, neighbor_dict, templates, template_sizes = dummy_data
    classifier = PTMLocalClassifier(
        positions=positions,
        box_bounds=box_bounds,
        neighbor_dict=neighbor_dict,
        templates=templates,
        template_sizes=template_sizes,
        max_neighbors=4
    )

    # Assign a types array with value 5, which is not in structure_names
    classifier.types = np.array([5, 5, 5, 5, 5], dtype=np.int32)
    classifier.quats = np.zeros((5, 4), dtype=np.float32)

    structure_name, fraction, counts = classifier.infer_structure_type()
    
    # All five entries are key=5 - counts {5:5}, the dominant type_key=5 not in structure_names
    assert structure_name == 'Unknown'
    assert pytest.approx(fraction, rel=1e-6) == 1.0  # 5/5 = 1.0
    assert counts == {5: 5}

if __name__ == '__main__':
    pytest.main([__file__])