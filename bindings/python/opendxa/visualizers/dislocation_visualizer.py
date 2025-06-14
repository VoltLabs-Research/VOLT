from opendxa import DislocationAnalysis, Logger

from typing import Dict, Optional, Tuple, List, Any
from dataclasses import dataclass, field
from pathlib import Path

import pyvista as pv
import numpy as np
import math

@dataclass
class VisualizationSettings:
    line_width: float = 3.0
    point_size: float = 2.0
    background_color: str = 'white'
    colormap: str = 'viridis'

    show_atoms: bool = False
    show_stacking_fauls: bool = False
    show_interface: bool = False
    show_grid: bool = False
    show_axes: bool = True
    show_background_mesh: bool = False
    show_plot: bool = True

    vtk_output: Optional[str] = None

    scalar_bar_args: Dict[str, Any] = field(default_factory=lambda: {
        'viewport': (0, 0, 0.2, 0.2),
        'line_width': 2,
        'cone_radius': 0.6,
        'shaft_length': 0.7,
        'tip_length': 0.3,
        'ambient': 0.5,
        'label_size': (0.4, 0.16)
    })

@dataclass
class DislocationStats:
    num_segments: int
    total_points: int
    total_length: float
    average_length: float
    max_length: float
    min_length: float
    burgers_magnitudes: List[float]
    unique_burgers_magnitudes: List[float]
    fractional_burgers: List[str]
    segment_info: List[Dict[str, Any]]
