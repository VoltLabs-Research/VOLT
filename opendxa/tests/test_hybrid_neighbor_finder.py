from opendxa.neighbors.hybrid import HybridNeighborFinder
import numpy as np
import pytest
import warnings

def make_stub_kernel(neighbor_lists, max_neighbors):
    '''
    Create a stub for find_neighbors_unified_kernel that returns
    fixed neighbor_lists for testing.

    neighbor_lists: dict mapping atom index -> list of neighbor indices
    max_neighbors: number of columns in the returned array
    '''
    def stub_kernel(positions, box_bounds, cutoff, lx, ly, lz, max_neighbors_arg):
        n = positions.shape[0]
        # Initialize with -1
        neigh_idx = -1 * np.ones((n, max_neighbors), dtype=np.int32)
        counts = np.zeros(n, dtype=np.int32)
        for i in range(n):
            lst = neighbor_lists.get(i, [])
            counts[i] = min(len(lst), max_neighbors)
            for k, j in enumerate(lst[:max_neighbors]):
                neigh_idx[i, k] = j
        return neigh_idx, counts

    return stub_kernel

def test_init_invalid_box_shape():
    positions = np.zeros((3, 3), dtype=np.float64)
    bad_box = np.array([[0, 10], [0, 10]], dtype=np.float64)
    with pytest.raises(ValueError):
        HybridNeighborFinder(positions, bad_box)

def test_init_invalid_box_values():
    positions = np.zeros((3, 3), dtype=np.float64)
    bad_box = np.array([[0, 10], [5, 5], [0, 10]], dtype=np.float64)
    with pytest.raises(ValueError):
        HybridNeighborFinder(positions, bad_box)

def test_init_invalid_cutoff():
    positions = np.zeros((3, 3), dtype=np.float64)
    box_bounds = np.array([[0, 5], [0, 5], [0, 5]], dtype=np.float64)
    # cutoff must be < min(box dimension), here min(box dimension) = 5
    with pytest.raises(ValueError):
        HybridNeighborFinder(positions, box_bounds, cutoff=10.0)

def test_init_invalid_num_neighbors():
    positions = np.zeros((3, 3), dtype=np.float64)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float64)
    # num_neighbors must be between 1 and N-1; here N=3 so valid = 1 or 2
    with pytest.raises(ValueError):
        HybridNeighborFinder(positions, box_bounds, num_neighbors=3)

def test_init_invalid_voronoi_factor():
    positions = np.zeros((3, 3), dtype=np.float64)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float64)
    # voronoi_factor must be > 1.0
    with pytest.raises(ValueError):
        HybridNeighborFinder(positions, box_bounds, voronoi_factor=1.0)

def test_build_dict_symmetry_and_sorting(monkeypatch):
    '''
    Stub out the CUDA kernel so that find_cutoff_neighbors() returns exactly
    our "neighbor_lists".  Then _build_dict() should (a) symmetrize and (b) sort each list.
    '''
    neighbor_lists = {
        0: [1, 2],
        1: [0],
        2: [0, 3],
        3: [2]
    }
    max_neighbors = 4
    stub = make_stub_kernel(neighbor_lists, max_neighbors)

    # PATCH the name that HybridNeighborFinder imported:
    monkeypatch.setattr(
        'opendxa.neighbors.hybrid.find_neighbors_unified_kernel',
        stub
    )

    positions = np.zeros((4, 3), dtype=np.float64)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float64)

    finder = HybridNeighborFinder(
        positions, box_bounds,
        cutoff=1.0,
        num_neighbors=2,
        voronoi_factor=1.5,
        max_neighbors=max_neighbors
    )

    cutoff_neighbors = finder.find_cutoff_neighbors()

    expected = {
        0: [1, 2],
        1: [0],
        2: [0, 3],
        3: [2]
    }
    assert cutoff_neighbors == expected

def test_find_voronoi_neighbors_selection(monkeypatch):
    '''
    Stub out find_neighbors_unified_kernel so that every atom sees
    all other atoms as candidates.  Then find_voronoi_neighbors()
    should pick the two closest by distance and symmetrize.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [3.0, 0.0, 0.0],
        [6.0, 0.0, 0.0]
    ], dtype=np.float64)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float64)

    # Make all‐to‐all neighbor list for the “enlarged_cutoff” step:
    neighbor_lists = {
        0: [1, 2, 3],
        1: [0, 2, 3],
        2: [0, 1, 3],
        3: [0, 1, 2]
    }
    max_neighbors = 4
    stub = make_stub_kernel(neighbor_lists, max_neighbors)

    # PATCH the name that HybridNeighborFinder actually uses:
    monkeypatch.setattr(
        'opendxa.neighbors.hybrid.find_neighbors_unified_kernel',
        stub
    )

    finder = HybridNeighborFinder(
        positions, box_bounds,
        cutoff=1.0,
        num_neighbors=2,
        voronoi_factor=2.0,  # enlarged_cutoff = 2.0
        max_neighbors=max_neighbors
    )

    voronoi_neighbors = finder.find_voronoi_neighbors()

    # For each atom i, exactly two nearest neighbors by x‐distance:
    #  - Atom 0 sees [1,2],  Atom 1 sees [0,2],  Atom 2 sees [1,3],  Atom 3 sees [2]
    # But 3 has only two others? Actually 3's two closest by squared‐distance are [2,1].
    # After symmetrization:
    #   0 ↔ 1,2
    #   1 ↔ 0,2,3
    #   2 ↔ 0,1,3
    #   3 ↔ 1,2
    # However the code picks exactly two per row, then enforces symmetry by appending if missing.

    # Let's verify length==2 for each before symmetrization.  After symmetrization, some rows gain a partner.
    for i, nbrs in voronoi_neighbors.items():
        # Each list must contain at least 'num_neighbors' entries:
        assert len(nbrs) >= 2 or len(nbrs) == (positions.shape[0] - 1)
        # Each j in nbrs was one of the stub candidates
        for j in nbrs:
            assert j in neighbor_lists[i]
        # Symmetry
        for j in nbrs:
            assert i in voronoi_neighbors[j]

def test_find_voronoi_neighbors_less_candidates_warns_and_uses_all(monkeypatch):
    '''
    If an atom has fewer than num_neighbors candidates, warn and use them all.
    Then after symmetrization, the neighbor lists should reflect mutual links.
    '''
    positions = np.array([
        [0.0, 0.0, 0.0],
        [5.0, 0.0, 0.0],
        [8.0, 0.0, 0.0]
    ], dtype=np.float64)
    box_bounds = np.array([[0, 10], [0, 10], [0, 10]], dtype=np.float64)

    neighbor_lists = {
        0: [1],       # only one candidate for atom 0
        1: [0, 2],    # two candidates for atom 1
        2: [1]        # only one candidate for atom 2
    }
    max_neighbors = 4
    stub = make_stub_kernel(neighbor_lists, max_neighbors)

    monkeypatch.setattr(
        'opendxa.neighbors.hybrid.find_neighbors_unified_kernel',
        stub
    )

    finder = HybridNeighborFinder(
        positions, box_bounds,
        cutoff=1.0,
        num_neighbors=2,
        voronoi_factor=2.0,
        max_neighbors=max_neighbors
    )

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always')
        voronoi_neighbors = finder.find_voronoi_neighbors()
        assert any('Atom 0' in str(wi.message) or 'Atom 2' in str(wi.message) for wi in w)

    # After selection and symmetrization:
    #  - Atom 0 can only use [1].
    #  - Atom 1 can pick [0,2].
    #  - Atom 2 can only use [1].
    # Symmetrize means 0<->1 and 1<->2.
    assert set(voronoi_neighbors[0]) == {1}
    assert set(voronoi_neighbors[1]) == {0, 2}
    assert set(voronoi_neighbors[2]) == {1}

def test_build_dict_is_pure_function():
    '''
    Directly test the static method _build_dict with a small example:
    neigh_idx = [[1, -1], [0, -1]] and counts = [1,1]
    Should give {0:[1], 1:[0]}.
    '''
    neigh_idx = np.array([[1, -1], [0, -1]], dtype=np.int32)
    counts = np.array([1, 1], dtype=np.int32)
    result = HybridNeighborFinder._build_dict(neigh_idx, counts)
    assert result == {0: [1], 1: [0]}


if __name__ == '__main__':
    pytest.main([__file__])