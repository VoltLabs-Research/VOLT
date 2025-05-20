import numpy as np

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

        def dfs(start, current, path, visited):
            if len(path) > self.max_length:
                return
            for nbr in self.connectivity.get(current, []):
                if nbr == start and len(path) >= 3:
                    norm_loop = self._normalize_loop(path)
                    if norm_loop not in seen:
                        seen.add(norm_loop)
                        loops.append(list(path))
                    return
                if nbr in visited or nbr < start:
                    continue
                path.append(nbr)
                visited.add(nbr)
                dfs(start, nbr, path, visited)
                path.pop()
                visited.remove(nbr)

        for i in range(self.N):
            dfs(i, i, [i], {i})

        loops = sorted(loops, key=self._loop_distance)
        return loops
