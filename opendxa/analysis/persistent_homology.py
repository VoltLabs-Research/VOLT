from ripser import ripser
from persim import plot_diagrams
import numpy as np

def compute_persistence_centroids(timesteps_data, maxdim=1):
    all_centroids = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            cent = np.mean(np.array(d['points']), axis=0)
            all_centroids.append(cent)
    all_centroids = np.vstack(all_centroids) if all_centroids else np.empty((0,3))
    if all_centroids.shape[0] < 3:
        print('Few points for persistent homology.')
        return None
    dgms = ripser(all_centroids, maxdim=maxdim)['dgms']
    plot_diagrams(dgms, show=True, title='Persistence Diagrams')
    return dgms
