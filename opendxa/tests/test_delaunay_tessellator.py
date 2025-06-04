from opendxa.classification.delaunay_tesselattor import DelaunayTessellator
import numpy as np

def test_ghosts_created_even_far_from_boundaries():
    '''
    Even if points are far from boundaries, the implementation creates ghosts
    for all 26 shifts. For N original atoms, extended_positions should have
    27*N entries (including originals).
    '''
    box_bounds = np.array([
        [0.0, 10.0],
        [0.0, 10.0],
        [0.0, 10.0]
    ], dtype=np.float64)

    positions = np.array([
        [5.0, 5.0, 5.0],
        [6.0, 5.0, 5.0]
    ], dtype=np.float64)

    tess = DelaunayTessellator(positions, box_bounds, ghost_layer_thickness=1.0)
    extended_positions = tess.extended_positions
    atom_mapping = tess.atom_mapping

    num_original = positions.shape[0]
    expected_size = num_original * 27  # 1 original + 26 ghost shifts
    assert extended_positions.shape[0] == expected_size, (
        f'Expected {expected_size} total points (including ghosts), got {extended_positions.shape[0]}'
    )

    # Mapping should have exactly expected_size entries
    assert len(atom_mapping) == expected_size
    # Check that the first num_original map to themselves
    for i in range(num_original):
        assert atom_mapping[i] == i

    # All ghost indices must map back to one of the original indices
    for idx, mapped in atom_mapping.items():
        assert mapped in set(range(num_original)), (
            f'Ghost index {idx} maps to unexpected {mapped}'
        )

def test_tessellate_simple_tetrahedron_contains_original_tet_and_connectivity():
    '''
    Four non-coplanar points inside the box produce many tetrahedra due to ghosts,
    but among valid_tetrahedra there must be one that uses exactly the four original indices.
    Connectivity for original atoms should include each other.
    '''
    box_bounds = np.array([
        [0.0, 10.0],
        [0.0, 10.0],
        [0.0, 10.0]
    ], dtype=np.float64)

    positions = np.array([
        [1.0, 1.0, 1.0],
        [2.0, 1.0, 1.0],
        [1.0, 2.0, 1.0],
        [1.0, 1.0, 2.0]
    ], dtype=np.float64)

    tess = DelaunayTessellator(positions, box_bounds, ghost_layer_thickness=0.5)
    result = tess.tessellate()

    tetrahedra = result['tetrahedra']
    connectivity = result['connectivity']
    delaunay_obj = result['tessellation']
    n_original = len(positions)
    original_indices_set = set(range(n_original))

    # Among delaunay_obj.simplices, there should be one simplex that is exactly the original indices
    found_original_tet = False
    for simplex in delaunay_obj.simplices:
        if set(simplex) == original_indices_set:
            found_original_tet = True
            break
    assert found_original_tet, (
        f'Expected at least one simplex with original indices {original_indices_set}, '
        f'got {delaunay_obj.simplices}'
    )

    # Among valid_tetrahedra, there must also be a tetrahedron that is exactly the four original indices
    found_in_valid = False
    for tet in tetrahedra:
        if set(tet) == original_indices_set:
            found_in_valid = True
            break
    assert found_in_valid, (
        f'Expected a valid tetrahedron with original indices {original_indices_set}, got {tetrahedra}'
    )

    # For each original atom, connectivity should include at least the other three
    for atom_idx in original_indices_set:
        neighbors = connectivity[atom_idx]
        expected_neighbors = original_indices_set - {atom_idx}
        assert neighbors.issuperset(expected_neighbors), (
            f'Atom {atom_idx} connectivity {neighbors}, expected at least {expected_neighbors}'
        )

def test_tessellate_coplanar_points_has_original_tetrahedra_and_connectivity():
    '''
    Four coplanar points inside the box will produce tetrahedra due to ghosts,
    and among valid_tetrahedra there should still be at least one simplex
    consisting solely of the four original indices. Connectivity for each
    original atom should link it to the other originals.
    '''
    box_bounds = np.array([
        [0.0, 5.0],
        [0.0, 5.0],
        [0.0, 5.0]
    ], dtype=np.float64)

    positions = np.array([
        [1.0, 1.0, 1.0],
        [2.0, 1.0, 1.0],
        [1.0, 2.0, 1.0],
        [2.0, 2.0, 1.0]
    ], dtype=np.float64)

    tess = DelaunayTessellator(positions, box_bounds, ghost_layer_thickness=0.5)
    result = tess.tessellate()

    tetrahedra = result['tetrahedra']
    connectivity = result['connectivity']
    delaunay_obj = result['tessellation']
    n_original = len(positions)
    original_indices_set = set(range(n_original))

    # Among valid_tetrahedra, there should be at least one tetrahedron
    # that uses exactly the four original indices
    found_original_tet = False
    for tet in tetrahedra:
        if set(tet) == original_indices_set:
            found_original_tet = True
            break
    assert found_original_tet, (
        f'Expected a valid tetrahedron with original indices {original_indices_set}, got {tetrahedra}'
    )

    # Connectivity: each original atom should connect to the other originals
    for atom_idx in original_indices_set:
        neighbors = connectivity[atom_idx]
        expected_neighbors = original_indices_set - {atom_idx}
        assert neighbors.issuperset(expected_neighbors), (
            f'Atom {atom_idx} connectivity {neighbors}, expected at least {expected_neighbors}'
        )
