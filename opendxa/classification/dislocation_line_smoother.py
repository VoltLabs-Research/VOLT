from typing import List
from scipy.interpolate import splprep, splev

import logging
import numpy as np

logger = logging.getLogger(__name__)

class DislocationLineSmoother:
    def __init__(
        self,
        smoothing_level: int = 3,
        point_interval: float = 1.0
    ):
        self.smoothing_level = smoothing_level
        self.point_interval = point_interval

    def smooth_lines(
        self,
        dislocation_lines: List[List[int]],
        positions: np.ndarray
    ) -> List[np.ndarray]:
        smoothed_lines = []
        for line_atoms in dislocation_lines:
            if len(line_atoms) < 3:
                smoothed_lines.append(positions[line_atoms])
                continue
                
            line_positions = positions[line_atoms]
            try:
                smoothed_position = self._smooth_spline(line_positions)
                smoothed_lines.append(smoothed_position)
            except Exception as e:
                logger.warning(f'Failed to smooth line: {e}')
            
        return smoothed_lines
    
    def _smooth_spline(self, line_positions: np.ndarray) -> np.ndarray:
        distances = np.sqrt(np.sum(np.diff(line_positions, axis=0)**2, axis=1))
        cumulative_length = np.concatenate([[0], np.cumsum(distances)])
        t = cumulative_length / cumulative_length[-1]
        smoothing_factor = 0.1 * self.smoothing_level
        tck, u = splprep([
            line_positions[:, 0], 
            line_positions[:, 1], 
            line_positions[:, 2]], 
            u=t, s=smoothing_factor, k=min(3, len(line_positions)-1)
        )
        
        u_smooth = np.linspace(0, 1, len(line_positions))
        smoothed_coords = splev(u_smooth, tck)
        
        return np.column_stack(smoothed_coords)