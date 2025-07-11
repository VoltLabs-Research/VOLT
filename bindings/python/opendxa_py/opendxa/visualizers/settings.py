from dataclasses import dataclass, field
from typing import Optional, Dict, Any

@dataclass
class VisualizationSettings:
    line_width: float = 3.0
    point_size: float = 2.0
    background_color: str = 'white'
    colormap: str = 'viridis'

    show_atoms: bool = False
    show_stacking_faults: bool = False
    show_interface: bool = False
    show_grid: bool = False
    show_axes: bool = True
    show_background_mesh: bool = False
    show_plot: bool = True
    core_atom_color: str = "red"
    bulk_atom_color: str = "lightgray"
    
    dislocation_opacity: float = 1.0
    atom_opacity: float = 0.6
    stacking_fault_opacity: float = 0.8
    interface_opacity: float = 0.3

    vtk_output: Optional[str] = None

    scalar_bar_args: Dict[str, Any] = field(default_factory=lambda: {
        'title': 'Burgers Vector Magnitudes',
        'title_font_size': 12,
        'label_font_size': 10,
        'position_x': 0.25,
        'position_y': 0.02,
        'width': 0.5, 
        'height': 0.05,
        'n_labels': 5,
        'fmt': '%.3f',
        'shadow': True
    })

    axes_args: Dict[str, Any] = field(default_factory=lambda: {
        'viewport': (0, 0, 0.15, 0.15),
        'line_width': 2,
        'cone_radius': 0.6,
        'shaft_length': 0.7,
        'tip_length': 0.3,
        'ambient': 0.5,
    })
