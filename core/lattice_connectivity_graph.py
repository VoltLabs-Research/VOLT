import numpy as np
from utils.cuda import quaternion_to_matrix

class LatticeConnectivityGraph:
    def __init__(
        self, positions, ids, neighbors,
        ptm_types, quaternions,
        templates, template_sizes,
        tolerance=0.2
    ):
        # Convert and validate
        self.positions = np.asarray(positions, dtype=np.float32)
        self.ids = np.asarray(ids)
        N = self.positions.shape[0]
        if self.ids.shape[0] != N:
            raise ValueError('ids length must match positions')
        # neighbors dict validation
        if not isinstance(neighbors, dict):
            raise ValueError('neighbors must be a dict')
        for i, nbrs in neighbors.items():
            if i < 0 or i >= N:
                raise ValueError(f'neighbor key {i} out of range')
            for j in nbrs:
                if j < 0 or j >= N:
                    raise ValueError(f'neighbor {j} of atom {i} out of range')
        self.neighbors = neighbors
        # PTM types and quaternions
        self.ptm_types = np.asarray(ptm_types, dtype=int)
        if self.ptm_types.shape[0] != N:
            raise ValueError('ptm_types length must match positions')
        self.quaternions = np.asarray(quaternions, dtype=np.float32)
        if self.quaternions.shape != (N,4):
            raise ValueError('quaternions must have shape (N,4)')
        # Templates
        self.templates = np.asarray(templates, dtype=np.float32)
        self.template_sizes = np.asarray(template_sizes, dtype=int)
        M = self.templates.shape[0]
        if self.template_sizes.shape[0] != M:
            raise ValueError('template_sizes length must match number of templates')
        self.tolerance = float(tolerance)

    def build_graph(self):
        N = self.positions.shape[0]
        graph = {i: [] for i in range(N)}

        for i in range(N):
            t = self.ptm_types[i]
            if t < 0:
                # skip disordered
                continue
            nbrs = self.neighbors.get(i, [])
            if not nbrs:
                continue
            # ideal template
            K = int(self.template_sizes[t])
            T = self.templates[t,:K,:]  # (K,3)
            # local real neighbors
            Pidx = np.array(nbrs, dtype=int)
            P = self.positions[Pidx] - self.positions[i]  # (len(nbrs),3)
            # compute local bond length scale
            dists = np.linalg.norm(P, axis=1)
            if dists.size == 0:
                continue
            scale = np.mean(dists)
            # rotation
            R = quaternion_to_matrix(self.quaternions[i])  # (3,3)
            # predicted neighbor positions in global coords
            preds = (R @ T.T).T * scale + self.positions[i]  # (K,3)
            # match preds to actual neighbor list
            for pred in preds:
                # compute distances to Pidx atoms
                diffs = self.positions[Pidx] - pred
                d2 = np.sum(diffs**2, axis=1)
                min_k = np.argmin(d2)
                if np.sqrt(d2[min_k]) <= self.tolerance * scale:
                    j = int(Pidx[min_k])
                    graph[i].append(j)
        # symmetrize
        for i, nbrs in graph.items():
            for j in nbrs:
                if i not in graph[j]:
                    graph[j].append(i)
        # sort
        for i in graph:
            graph[i] = sorted(set(graph[i]))
        return graph
