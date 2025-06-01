import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

class FilteredLoopFinder:
    '''
    Find all unique simple loops (cycles) in a connectivity graph up to a given length,
    filtering out geometrically equivalent loops and respecting a timeout and maximum count.
    '''

    def __init__(
        self,
        connectivity: dict,
        positions: np.ndarray,
        max_length: int = 8,
        max_loops: int = 1000,
        timeout_seconds: float = 300.0      
    ): 
        '''
        Args:
            connectivity (dict): Mapping from atom index (int) to iterable of neighbor indices (ints).
            positions (np.ndarray): Array of shape (N_atoms, 3) with x,y,z coordinates.
            max_length (int): Maximum number of edges in a loop (minimum 3).
            max_loops (int): Maximum number of loops to find before stopping.
            timeout_seconds (float): Max seconds to spend searching before quitting.

        Raises:
            ValueError: If inputs are improperly formatted or out of valid range.
        '''

        # Validate positions
        self.positions = np.asarray(positions, dtype=np.float32)
        if self.positions.ndim != 2 or self.positions.shape[1] != 3:
            raise ValueError(f'positions must be a 2D array of shape (N, 3), got {self.positions.shape}')

        self.N = self.positions.shape[0]

        self.connectivity = {}
        for key, nbrs in connectivity.items():
            try:
                validated = set(int(n) for n in nbrs)
            except Exception:
                raise ValueError(f'Neighbors for atom {key} must be iterable of ints')
            for n in validated:
                if n < 0 or n >= self.N:
                    raise ValueError(f'Neighbor index {n} for atom {key} is out of range [0, {self.N - 1}]')
                
            # Remove self-loops if any
            if key in validated:
                validated.discard(key)
            self.connectivity[key] = sorted(validated)

        # Validate parameters
        if max_length < 3:
            raise ValueError('max_length must be at least 3')
        if max_loops < 1:
            raise ValueError('max_loops must be >= 1')
        if timeout_seconds <= 0:
            raise ValueError('timeout_seconds must be positive')

        self.max_length = max_length
        self.max_loops = max_loops
        self.timeout_seconds = timeout_seconds

    def _normalize_loop(self, loop):
        '''
        Normalize a loop (simple cycle) by rotating and reversing so that
        its lexicographically smallest representation is chosen.

        Args:
            loop (list[int]): Sequence of atom indices forming a closed loop.

        Returns:
            tuple: The normalized tuple of indices.
        '''
        # All cyclic rotations
        n = len(loop)
        rotations = [tuple(loop[i:] + loop[:i]) for i in range(n)]
        # All reversed rotations
        rev = list(reversed(loop))
        rotations += [tuple(rev[i:] + rev[:i]) for i in range(n)]
        return min(rotations)
    
    def _loop_distance(self, loop):
        '''
        Compute the total Euclidean length of a loop.

        Args:
            loop (list[int]): Closed loop of atom indices (last->first implied).

        Returns:
            float: Sum of distances between consecutive positions.
        '''
        pts = self.positions[loop]
        shifted = np.roll(pts, -1, axis=0)
        return float(np.sum(np.linalg.norm(shifted - pts, axis=1)))

    def find_minimal_loops(self):
        '''
        Perform a depth-first search from each atom to find all unique loops up to max_length.
        Stops early if max_loops is reached or timeout.

        Returns:
            list: List of unique loops (each is a list of atom indices), sorted by geometric length.
        '''
        seen = set()
        loops = []
        start_time = time.time()
        
        total_connections = sum(len(neighbors) for neighbors in self.connectivity.values()) // 2
        logger.info(f'Loop finding: {total_connections} connections, max_length={self.max_length}')

        def dfs(start: int, current: int, path: list, visited: set) -> bool:
            # Check timeout
            if time.monotonic() - start_time > self.timeout_seconds:
                logger.warning(f'Loop finding timeout after {self.timeout_seconds:.1f}s')
                # Signal timeout
                return True 

            # Check max loops
            if len(loops) >= self.max_loops:
                logger.warning(f'Loop finding stopped at {self.max_loops} loops limit')
                # Signal limit reached
                return True
            
            if len(path) > self.max_length:
                return False

            for nbr in self.connectivity.get(current, []):
                if nbr == start and len(path) >= 3:
                    norm = self._normalize_loop(path.copy())
                    if norm not in seen:
                        seen.add(norm)
                        loops.append(path.copy())
                    return False

                # Prevent revisiting a node or exploring atoms < start to avoid duplicates
                if nbr in visited or nbr < start:
                    continue

                path.append(nbr)
                visited.add(nbr)
                stop = dfs(start, nbr, path, visited)
                if stop:
                    return True
                path.pop()
                visited.remove(nbr)
            return False

        # Batch atoms for progress logging
        batch_size = max(1, self.N // 10)
        for batch_start in range(0, self.N, batch_size):
            batch_end = min(batch_start + batch_size, self.N)
            for i in range(batch_start, batch_end):
                if dfs(i, i, [i], {i}):
                    break

            # Progress report
            progress = (batch_end / self.N) * 100.0
            elapsed = time.monotonic() - start_time
            logger.info(
                f'Progress: {progress:.1f}% ({batch_end}/{self.N} atoms), '
                f'{len(loops)} loops found, elapsed {elapsed:.1f}s'
            )

            if len(loops) >= self.max_loops or (time.monotonic() - start_time) > self.timeout_seconds:
                break

        # Sort loops by geometric length
        loops.sort(key=self._loop_distance)
        total_time = time.monotonic() - start_time
        logger.info(f'Loop finding completed: {len(loops)} loops in {total_time:.1f}s')
        return loops