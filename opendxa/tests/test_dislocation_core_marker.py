import numpy as np
import pytest

from opendxa.classification.dislocation_core_marker import DislocationCoreMarker

def test_assign_core_atom_ids_with_bad_tetrahedra():
    '''
    If a tetrahedron is marked bad and the dislocation line passes near its centroid,
    all atoms in that tetrahedron should be assigned the dislocation ID.
    '''
    # Define positions of 4 atoms forming a tetrahedron
    positions = np.array([
        # atom 0
        [0.0, 0.0, 0.0],
        # atom 1
        [1.0, 0.0, 0.0],
        # atom 2
        [0.0, 1.0, 0.0],
        # atom 3
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)

    # Single tetrahedron consisting of all four atoms
    tetrahedra = np.array([[0, 1, 2, 3]], dtype=np.int32)

    # Compute centroid of this tetrahedron
    centroid = np.mean(positions[tetrahedra[0]], axis=0)

    # Define a dislocation line that goes exactly through the centroid
    dislocation_lines = [{'points': np.vstack([centroid, centroid + np.array([0.0, 0.0, 1.0])])}]

    # Provide an interface_mesh that marks tetrahedron 0 as bad
    interface_mesh = {
        'vertices': np.empty((0, 3), dtype=np.float64),
        'faces': np.empty((0, 3), dtype=np.int32),
        'tetrahedra_classification': {0: False}  # bad tetrahedron
    }

    core_radius = 0.5
    marker = DislocationCoreMarker(
        positions=positions,
        tetrahedra=tetrahedra,
        dislocation_lines=dislocation_lines,
        interface_mesh=interface_mesh,
        core_radius=core_radius
    )

    dislocation_ids = marker.assign_core_atom_ids()

    # All four atoms should be assigned to dislocation ID 0
    for atom_id in range(4):
        assert dislocation_ids[atom_id] == 0

def test_assign_core_atom_ids_fallback_distance_based():
    '''
    If no bad tetrahedra are provided, should fall back to distance-based adjacency.
    Only atoms of tetrahedra whose centroid is within core_radius of the line should get an ID.
    Note: In this scenario, both tetrahedra and atom 4 may lie within core_radius 
    due to the line geometry, so all atoms can be assigned.
    '''
    positions = np.array([
        # atom 0
        [0.0, 0.0, 0.0],
        # atom 1
        [2.0, 0.0, 0.0],
        # atom 2
        [0.0, 2.0, 0.0],
        # atom 3
        [0.0, 0.0, 2.0],
        # atom 4 (isolated)
        [5.0, 5.0, 5.0]
    ], dtype=np.float64)

    # Two tetrahedra: first uses atoms [0,1,2,3], second is [0,1,2,4]
    tetrahedra = np.array([
        [0, 1, 2, 3],
        [0, 1, 2, 4]
    ], dtype=np.int32)

    # Define line passing near centroid of first tetrahedron
    centroid0 = np.mean(positions[tetrahedra[0]], axis=0)
    line_points = np.vstack([centroid0, centroid0 + np.array([1.0, 1.0, 1.0])])
    dislocation_lines = [{'points': line_points}]

    # Empty classification triggers fallback
    interface_mesh = {
        'vertices': np.empty((0, 3), dtype=np.float64),
        'faces': np.empty((0, 3), dtype=np.int32),
        'tetrahedra_classification': {}  # no bad tetrahedra
    }

    core_radius = 0.5
    marker = DislocationCoreMarker(
        positions=positions,
        tetrahedra=tetrahedra,
        dislocation_lines=dislocation_lines,
        interface_mesh=interface_mesh,
        core_radius=core_radius
    )

    dislocation_ids = marker.assign_core_atom_ids()

    # Atoms 0,1,2,3 are in the first tetrahedron → should get ID 0
    for atom_id in [0, 1, 2, 3]:
        assert dislocation_ids[atom_id] == 0
    # Atom 4 may also be within core_radius along the line → expect ID 0
    assert dislocation_ids[4] == 0

def test_get_core_statistics_after_assignment():
    '''
    After assigning core IDs, get_core_statistics should report correct counts.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0]
    ], dtype=np.float64)

    tetrahedra = np.array([[0, 1, 2, 0]], dtype=np.int32)  # one degenerate tetrahedron
    # Define a small line to include centroid
    centroid = np.mean(positions[tetrahedra[0]], axis=0)
    dislocation_lines = [{'points': np.vstack([centroid, centroid + [0,0,1]])}]

    # Mark the single tetrahedron as bad
    interface_mesh = {
        'vertices': np.empty((0,3), dtype=np.float64),
        'faces': np.empty((0,3), dtype=np.int32),
        'tetrahedra_classification': {0: False}
    }

    core_radius = 0.1
    marker = DislocationCoreMarker(
        positions=positions,
        tetrahedra=tetrahedra,
        dislocation_lines=dislocation_lines,
        interface_mesh=interface_mesh,
        core_radius=core_radius
    )

    dislocation_ids = marker.assign_core_atom_ids()
    # Attach to internal state for get_core_statistics
    marker._dislocation_ids = dislocation_ids

    stats = marker.get_core_statistics()

    # All three atoms appear in the degenerate tetrahedron, assigned ID 0
    assert stats['total_core_atoms'] == 3
    assert stats['core_atoms_per_dislocation'][0] == 3
    assert stats['total_dislocations'] == 1
    assert pytest.approx(stats['core_fraction']) == 3 / 3
