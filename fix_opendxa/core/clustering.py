from collections import deque, defaultdict
from typing import List, Dict

import numpy as np

NUM_RECURSIVE_WALK_PRIORITIES = 3
IDENTITY = np.eye(3)
UNDEFINED = -1

def is_rotation_matrix(m):
    return np.allclose(m @ m.T, np.eye(m.shape[0])) and np.isclose(np.linalg.det(m), 1.0)

class LatticeOrientation:
    def __init__(self, mat=None):
        self.mat = np.copy(mat) if mat is not None else np.eye(3)

    def equals(self, other):
        return np.allclose(self.mat, other.mat)
    
    def inverse(self):
        return LatticeOrientation(np.linalg.inv(self.mat))
    
    def __mul__(self, other):
        if isinstance(other, LatticeOrientation):
            return LatticeOrientation(np.dot(self.mat, other.mat))

        return NotImplemented
    
    def is_rotation_matrix(self):
        return np.allclose(self.mat @ self.mat.T, np.eye(self.mat.shape[0])) and np.isclose(np.linalg.det(self.mat), 1.0)
    
    def copy(self):
        return LatticeOrientation(np.copy(self.mat))
    
