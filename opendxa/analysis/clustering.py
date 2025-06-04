import numpy as np
from sklearn.cluster import KMeans

def cluster_centroids(timesteps_data, n_clusters=3):
    centroids_all = []
    for dislocs in timesteps_data.values():
        for d in dislocs:
            pts = np.array(d['points'])
            centroids_all.append(np.mean(pts, axis=0))
    centroids_all = np.array(centroids_all)

    if centroids_all.size == 0:
        raise ValueError('No centroids found to cluster.')

    kmeans = KMeans(n_clusters=n_clusters)
    labels = kmeans.fit_predict(centroids_all)
    return kmeans, centroids_all, labels
