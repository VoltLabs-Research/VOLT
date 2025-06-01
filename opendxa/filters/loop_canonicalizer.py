import numpy as np

class LoopCanonicalizer:
    '''
    Filter out geometrically equivalent redundant loops (rotations + PBC + rounding)
    so that each unique dislocation loop is counted only once.
    '''
    def __init__(self, positions: np.ndarray, box_bounds: np.ndarray = None, rounding_decimals: int = 4):
        '''
        Args:
            positions (np.ndarray): Array of shape (N_atoms, 3) with x,y,z coordinates.
            box_bounds (np.ndarray, optional): Array of shape (3,2), where each row is [min, max]
                                                for the corresponding axis. If None, no PBC is applied.
            rounding_decimals (int): Number of decimals to keep when hashing segment vectors.

        Raises:
            ValueError: If positions is not (N,3), or if box_bounds (when given) is not (3,2).
        '''
        self.positions = np.asarray(positions, dtype=np.float32)
        if self.positions.ndim != 2 or self.positions.shape[1] != 3:
            raise ValueError(f'positions must be shape (N,3), got {self.positions.shape}')

        if box_bounds is not None:
            box = np.asarray(box_bounds, dtype=np.float32)
            if box.shape != (3, 2):
                raise ValueError(f'box_bounds must be shape (3, 2), got {box.shape}')
            self.box_bounds = box
            self.box_lengths = box[:, 1] - box[:, 0]
        else:
            self.box_bounds = None
            self.box_lengths = None
        
        self.rounding_decimals = rounding_decimals

    def _apply_pbc(self, diffs: np.ndarray):
        '''
        Apply minimum-image PBC to an array of displacement vectors.

        Args:
            diffs (np.ndarray): Array of shape (M,3) of raw displacements.

        Returns:
            np.ndarray: Array of same shape, with displacements wrapped via PBC.
        '''
        wrapped = diffs.copy()
        for d in range(3):
            L = self.box_lengths[d]
            # Shift components > +L/2 back by L, < -L/2 forward by L
            wrapped[:, d] -= np.round(wrapped[:, d] / L) * L
        return wrapped

    def _get_loop_differences(self, loop: np.ndarray) -> np.ndarray:
        '''
        Given a sequence of atom indices forming a closed loop, compute the segment vectors
        between consecutive points (with PBC corrections if box_bounds is set).

        Args:
            loop (np.ndarray): 1D array of integer atom indices (e.g., [i0, i1, i2, ..., i0]).

        Returns:
            np.ndarray: Array of shape (M,3), where M = len(loop) - 1, containing segment vectors.

        Raises:
            ValueError: If any index in loop is out of range or loop has fewer than 2 points.
        '''
        if len(loop) < 2:
            raise ValueError(f"Loop must contain at least 2 indices, got {len(loop)}")

        if np.any(loop < 0) or np.any(loop >= self.positions.shape[0]):
            raise ValueError(f"Loop contains invalid atom index (must be in [0, {self.positions.shape[0]-1}])")

        # Extract unique sequence of positions for the loop
        pts = self.positions[loop]

        # Differences between consecutive points (assumes loop is closed: last -> first)
        diffs = np.roll(pts, -1, axis=0) - pts

        if self.box_bounds is not None:
            diffs = self._apply_pbc(diffs)

        return diffs

    def _generate_variants(self, diffs: np.ndarray) -> np.ndarray:
        '''
        Generate all cyclic rotations and their reversals of a sequence of segment vectors.

        Args:
            diffs (np.ndarray): Array of shape (M,3).

        Returns:
            np.ndarray: Array of shape (2*M, M, 3), containing all 2*M variants.
                        The first M entries are rotations, the next M are reversed rotations.
        '''
        n = diffs.shape[0]
        variants = np.empty((2 * n, n, 3), dtype=diffs.dtype)

        for i in range(n):
            # rotation by i
            variants[i] = np.roll(diffs, -i, axis=0)
            # rotation of reversed sequence
            variants[n + i] = np.roll(diffs[::-1], -i, axis=0)

        return variants
    
    def _diffs_to_hash(self, diffs: np.ndarray) -> str:
        '''
        Convert a single sequence of segment vectors into a rounded string key.

        Args:
            diffs (np.ndarray): Array of shape (M,3).

        Returns:
            str: Semicolon-separated string, each vector as "x,y,z" with rounding.
        '''
        # Round each component to avoid tiny floating errors
        rounded = np.round(diffs, decimals=self.rounding_decimals)
        # Flatten each row to "x,y,z"
        flat = [f"{vec[0]:.{self.rounding_decimals}f},{vec[1]:.{self.rounding_decimals}f},{vec[2]:.{self.rounding_decimals}f}"
                for vec in rounded]
        return ';'.join(flat)

    def _loop_hash(self, diffs):
        '''
        Compute a canonical hash for a loop by generating all variants and picking
        the lexicographically smallest string representation.

        Args:
            diffs (np.ndarray): Array of shape (M,3).

        Returns:
            str: Minimum hash among all rotations + reversals.
        '''
        variants = self._generate_variants(diffs)
        # Convert each variant to a hash string
        hash_strings = [self._diffs_to_hash(variants[i]) for i in range(variants.shape[0])]
        return min(hash_strings)

    def canonicalize(self, loops: np.ndarray) -> list:
        '''
        From a list of loops (each an array of atom indices), filter out those that
        are geometrically redundant under rotations + PBC + reversals.

        Args:
            loops (np.ndarray or list of arrays): Iterable of 1D integer arrays, each representing a closed loop.

        Returns:
            list: A list of unique loops (in the same format as the input), preserving the first occurrence
                  of each unique geometry.

        Raises:
            ValueError: If loops is not an iterable of 1D integer arrays.
        '''
        seen_hashes = set()
        unique_loops = []

        for loop in loops:
            loop_arr = np.asarray(loop, dtype=int).ravel()
            # Compute segment differences
            diffs = self._get_loop_differences(loop_arr)
            # Hash the loop geometry
            h = self._loop_hash(diffs)
            if h not in seen_hashes:
                seen_hashes.add(h)
                unique_loops.append(loop_arr.copy())

        return unique_loops
