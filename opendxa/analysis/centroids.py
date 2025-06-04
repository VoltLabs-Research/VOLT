import numpy as np

def compute_centroids(timesteps_data):
    '''
    Args:
        timesteps_data: dict {t: [ { 'points': [[x,y,z],…], … }, … ] }

    Returns:
        List of tuples (timestep, np.ndarray de forma (N_t,3) con los centroides).
    '''
    result = []
    for t, dislocs in timesteps_data.items():
        centroids = []
        for d in dislocs:
            pts = np.array(d['points'])   # shape (M,3)
            centroids.append(np.mean(pts, axis=0))
        result.append((t, np.array(centroids)))
    return result