import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

# Find closed loops in the connectivity network (DFS + simple rotational redundant elimination).
class FilteredLoopFinder:
    def __init__(self, connectivity, positions, max_length=8):
        self.connectivity = connectivity
        self.positions = np.asarray(positions, dtype=np.float32)
        self.max_length = max_length
        self.N = len(self.positions)

    def _normalize_loop(self, loop):
        loop = list(loop)
        perms = [loop[i:] + loop[:i] for i in range(len(loop))]
        perms_rev = [list(reversed(p)) for p in perms]
        all_forms = perms + perms_rev
        return tuple(min(all_forms))

    def _loop_distance(self, loop):
        pts = self.positions[loop]
        d = np.sum(np.linalg.norm(np.roll(pts, -1, axis=0) - pts, axis=1))
        return d

    def find_minimal_loops(self):
        seen = set()
        loops = []
        start_time = time.time()
        
        total_connections = sum(len(neighbors) for neighbors in self.connectivity.values()) // 2
        logger.info(f'Loop finding: {total_connections} connections, max_length={self.max_length}')

        def dfs(start, current, path, visited):
            # Check timeout
            if time.time() - start_time > self.timeout_seconds:
                logger.warning(f'Loop finding timeout after {self.timeout_seconds}s')
                return True  # Signal timeout
                
            # Check max loops limit
            if len(loops) >= self.max_loops:
                logger.warning(f'Loop finding stopped at {self.max_loops} loops limit')
                return True  # Signal limit reached
                
            if len(path) > self.max_length:
                return False
                
            for nbr in self.connectivity.get(current, []):
                if nbr == start and len(path) >= 3:
                    norm_loop = self._normalize_loop(path)
                    if norm_loop not in seen:
                        seen.add(norm_loop)
                        loops.append(list(path))
                    return False
                if nbr in visited or nbr < start:
                    continue
                path.append(nbr)
                visited.add(nbr)
                # Propagate timeout/limit signal
                if dfs(start, nbr, path, visited):
                    return True
                path.pop()
                visited.remove(nbr)
            return False

        # Process atoms in batches to provide progress feedback
        batch_size = max(1, self.N // 10)
        for batch_start in range(0, self.N, batch_size):
            batch_end = min(batch_start + batch_size, self.N)
            for i in range(batch_start, batch_end):
                # Break on timeout or limit
                if dfs(i, i, [i], {i}):
                    break
            
            # Progress logging
            progress = (batch_end / self.N) * 100
            elapsed = time.time() - start_time
            logger.info(f'Loop finding progress: {progress:.1f}% ({batch_end}/{self.N} atoms), '
                       f'{len(loops)} loops found, elapsed: {elapsed:.1f}s')
            
            if len(loops) >= self.max_loops or elapsed > self.timeout_seconds:
                break

        loops = sorted(loops, key=self._loop_distance)
        logger.info(f'Loop finding completed: {len(loops)} loops found in {time.time() - start_time:.1f}s')
        return loops
