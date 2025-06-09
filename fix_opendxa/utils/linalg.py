import numpy as np

def normalize(vector):
    normalized_vector = np.linalg.norm(vector)
    if normalized_vector < 1e-12:
        return vector
    return vector / normalized_vector