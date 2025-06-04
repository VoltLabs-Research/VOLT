import numpy as np
import networkx as nx

def compute_anisotropy_eigenvalues(timesteps_data):
    centroids = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            centroids.append(np.mean(np.array(d['points']), axis=0))
    if len(centroids) < 3:
        return None
    C = np.vstack(centroids)
    mean = C.mean(axis=0)
    cov = np.cov((C - mean).T)
    eigs, _ = np.linalg.eigh(cov)
    return np.sort(eigs)[::-1]

def compute_laplacian_spectrum(G):
    L = nx.laplacian_matrix(G).astype(float).toarray()
    eigs = np.linalg.eigvalsh(L)
    return np.sort(eigs)
