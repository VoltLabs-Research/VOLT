import numpy as np

class SurfaceFilter:
    def __init__(self, min_neighbors):
        if not isinstance(min_neighbors, int) or min_neighbors < 0:
            raise ValueError('min_neighbors must be a non-negative integer')
        self.min_neighbors = min_neighbors

    def filter_indices(self, neighbors, types=None):
        if not isinstance(neighbors, dict):
            raise ValueError('neighbors must be a dict')
        # determine N from neighbors keys
        keys = list(neighbors.keys())
        if not keys:
            return []
        N = max(keys) + 1
        # validate types
        if types is not None:
            types = np.asarray(types)
            if types.ndim != 1 or len(types) != N:
                raise ValueError('types must be 1D array of length N')
        interior = []
        for i, nbrs in neighbors.items():
            if i < 0 or i >= N:
                raise ValueError(f'neighbor key {i} out of range [0, {N})')
            if not isinstance(nbrs, (list, tuple)):
                raise ValueError(f'neighbors[{i}] must be a list or tuple')
            if len(nbrs) < self.min_neighbors:
                continue
            if types is not None and types[i] < 0:
                continue
            interior.append(i)
        return interior

    def filter_data(self, positions, ids, neighbors, types=None, quaternions=None):
        positions = np.asarray(positions)
        ids = np.asarray(ids)
        if positions.ndim != 2 or positions.shape[0] != ids.shape[0]:
            raise ValueError('positions and ids must have same length N')
        N = positions.shape[0]
        # validate types
        if types is not None:
            types = np.asarray(types)
            if types.ndim != 1 or types.shape[0] != N:
                raise ValueError('types must be length N')
        # validate quaternions
        if quaternions is not None:
            quaternions = np.asarray(quaternions)
            if quaternions.ndim != 2 or quaternions.shape[0] != N or quaternions.shape[1] != 4:
                raise ValueError('quaternions must be shape (N,4)')
        # filter indices
        interior = self.filter_indices(neighbors, types)
        # M = len(interior)
        # build old->new map
        old2new = {old: new for new, old in enumerate(interior)}
        # filter positions and ids
        out_positions = positions[interior]
        out_ids = ids[interior]
        # filter neighbors
        out_neighbors = {}
        for old in interior:
            new_i = old2new[old]
            nbrs = neighbors.get(old, [])
            filtered = []
            for j in nbrs:
                if j in old2new:
                    filtered.append(old2new[j])
                else:
                    # skip neighbors outside interior set
                    continue
            out_neighbors[new_i] = filtered
        # prepare output dict
        result = {
            'positions': out_positions,
            'ids': out_ids,
            'neighbors': out_neighbors,
            'types': None,
            'quaternions': None
        }
        if types is not None:
            result['types'] = types[interior]
        if quaternions is not None:
            result['quaternions'] = quaternions[interior]
        return result
