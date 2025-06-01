import numpy as np


class LoopGrouper:
    '''
    Group loops that are similar spatially and in Burgers vector orientation.
    '''

    def __init__(
        self,
        burgers_vectors,
        loops,
        positions,
        distance_threshold: float = 5.0,
        angular_threshold: float = 0.1
    ):
        '''
        Args:
            burgers_vectors (dict or list or np.ndarray): If dict, maps loop index to Burgers vector (3 floats).
                If list/np.ndarray, must be shape (N_loops, 3).
            loops (list of list[int]): Each entry is a list of atom indices forming a loop.
            positions (np.ndarray): Array of shape (N_atoms, 3) with x,y,z coordinates.
            distance_threshold (float): Max center-to-center distance to consider loops similar.
            angular_threshold (float): Max angle (in radians) between normalized Burgers vectors.

        Raises:
            ValueError: If inputs are improperly formatted or contain invalid values.
        '''
        # Validate positions
        self.positions = np.asarray(positions, dtype=np.float32)
        if self.positions.ndim != 2 or self.positions.shape[1] != 3:
            raise ValueError(f'positions must be a 2D array of shape (N, 3), got {self.positions.shape}')
        self.N_atoms = self.positions.shape[0]

        # Validate loops
        if not isinstance(loops, (list, tuple, np.ndarray)):
            raise ValueError('loops must be a list (or similar) of index lists')
        self.loops = []
        for idx, loop in enumerate(loops):
            try:
                loop_arr = np.asarray(loop, dtype=int).ravel().tolist()
            except Exception:
                raise ValueError(f'Loop {idx} is not a valid sequence of integers')
            if len(loop_arr) < 3:
                raise ValueError(f'Loop {idx} must contain at least 3 indices, got {len(loop_arr)}')
            for atom_idx in loop_arr:
                if atom_idx < 0 or atom_idx >= self.N_atoms:
                    raise ValueError(f'Atom index {atom_idx} in loop {idx} is out of range [0, {self.N_atoms - 1}]')
            self.loops.append(loop_arr)
        n_loops = len(self.loops)

        # Validate burgers_vectors, allowing dict or array-like
        if isinstance(burgers_vectors, dict):
            try:
                b_list = [burgers_vectors[i] for i in range(n_loops)]
            except KeyError:
                raise ValueError('If burgers_vectors is a dict, it must contain keys 0..N_loops-1')
            b_arr = np.asarray(b_list, dtype=np.float32)
        else:
            b_arr = np.asarray(burgers_vectors, dtype=np.float32)
            if b_arr.ndim != 2 or b_arr.shape[0] != n_loops or b_arr.shape[1] != 3:
                raise ValueError(f'burgers_vectors must be shape (N_loops, 3), got {b_arr.shape}')
        norms = np.linalg.norm(b_arr, axis=1)
        if np.any(norms < 1e-8):
            raise ValueError('All Burgers vectors must have non-zero magnitude')
        self.burgers = b_arr
        self.burgers_norm = norms

        # Validate thresholds
        if distance_threshold < 0:
            raise ValueError('distance_threshold must be non-negative')
        if angular_threshold < 0 or angular_threshold > np.pi:
            raise ValueError('angular_threshold must be in [0, pi]')

        self.dist_thresh = float(distance_threshold)
        self.angle_thresh = float(angular_threshold)

    def _normalize_loop(self, loop):
        '''
        Return the lexicographically smallest cyclic rotation or its reverse.
        '''
        n = len(loop)
        rotations = [tuple(loop[i:] + loop[:i]) for i in range(n)]
        rev = list(reversed(loop))
        rotations += [tuple(rev[i:] + rev[:i]) for i in range(n)]
        return min(rotations)

    def _loop_center(self, loop):
        '''
        Compute centroid of atom positions in the loop.
        '''
        pts = self.positions[loop]
        return np.mean(pts, axis=0)

    def _are_similar(self, i, j):
        '''
        Check if loops i and j have similar Burgers direction and centers within thresholds.
        '''
        # Normalize Burgers vectors
        b1 = self.burgers[i] / self.burgers_norm[i]
        b2 = self.burgers[j] / self.burgers_norm[j]
        cos_val = np.dot(b1, b2)
        # Clamp to [-1,1] to avoid NaN from floating errors
        cos_val = max(-1.0, min(1.0, cos_val))
        angle = np.arccos(abs(cos_val))
        if angle > self.angle_thresh:
            return False

        # Compare loop centroids
        c1 = self._loop_center(self.loops[i])
        c2 = self._loop_center(self.loops[j])
        dist = np.linalg.norm(c1 - c2)
        if dist > self.dist_thresh:
            return False

        return True

    def group_loops(self):
        '''
        Group loops into clusters of similar spatial location and Burgers direction.

        Returns:
            list of list[int]: Each sublist contains indices of loops in one group.
        '''
        n_loops = len(self.loops)
        used = set()
        grouped = []

        for i in range(n_loops):
            if i in used:
                continue
            group = [i]
            used.add(i)
            for j in range(i + 1, n_loops):
                if j in used:
                    continue
                if self._are_similar(i, j):
                    group.append(j)
                    used.add(j)
            grouped.append(group)

        return grouped
