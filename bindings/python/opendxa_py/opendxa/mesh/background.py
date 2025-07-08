import pyvista as pv
from typing import Tuple

def build_background_mesh(bounds: Tuple[float, ...]) -> pv.PolyData:
    if len(bounds) < 6:
        bounds = (-10, 10, -10, 10, -10, 10)
    
    x_range = bounds[1] - bounds[0]
    y_range = bounds[3] - bounds[2]
    z_range = bounds[5] - bounds[4]
    
    x_spacing = max(x_range / 19, 0.1)
    y_spacing = max(y_range / 19, 0.1)
    z_spacing = max(z_range / 19, 0.1)
    
    background_grid = pv.ImageData(
        dimensions=(20, 20, 20),
        spacing=(x_spacing, y_spacing, z_spacing),
        origin=(bounds[0], bounds[2], bounds[4])
    )

    return background_grid.outline()