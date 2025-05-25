from typing import Tuple
import numpy as np
import logging

logger = logging.getLogger(__name__)

def unwrap_pbc_displacement(displacement: np.ndarray, box_bounds: np.ndarray) -> np.ndarray:
    box_lengths = box_bounds[:, 1] - box_bounds[:, 0]
    
    # Apply minimum image convention
    unwrapped = displacement.copy()
    for dim in range(3):
        box_length = box_lengths[dim]
        # Wrap displacement to [-L/2, L/2]
        while unwrapped[dim] > box_length / 2:
            unwrapped[dim] -= box_length
        while unwrapped[dim] <= -box_length / 2:
            unwrapped[dim] += box_length
    
    return unwrapped