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

def unwrap_pbc_positions(
    positions: np.ndarray, 
    box_bounds: np.ndarray, 
    reference_pos: np.ndarray = None
) -> np.ndarray:
    """
    Unwrap atomic positions across periodic boundaries
    
    Args:
        positions: Atomic positions
        box_bounds: Box bounds [[xlo, xhi], [ylo, yhi], [zlo, zhi]]
        reference_pos: Reference position (typically center of mass)
        
    Returns:
        Unwrapped positions
    """
    if reference_pos is None:
        reference_pos = np.mean(positions, axis=0)
    
    box_lengths = box_bounds[:, 1] - box_bounds[:, 0]
    unwrapped_positions = positions.copy()
    
    for i, pos in enumerate(positions):
        for dim in range(3):
            box_length = box_lengths[dim]
            diff = pos[dim] - reference_pos[dim]
            
            # Apply minimum image convention
            if diff > box_length / 2:
                unwrapped_positions[i, dim] -= box_length
            elif diff <= -box_length / 2:
                unwrapped_positions[i, dim] += box_length
    
    return unwrapped_positions