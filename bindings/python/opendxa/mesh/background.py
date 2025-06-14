import pyvista as pv
from typing import Tuple

def build_background_mesh(bounds: Tuple[float, ...]) -> pv.PolyData:
    background_grid = pv.ImageData(
        dimensions=(20, 20, 20),
        spacing=((bounds[1] - bounds[0]) / 19, (bounds[3] - bounds[2]) / 19, (bounds[5] - bounds[4]) / 19),
        origin=(bounds[0], bounds[2], bounds[4])
    )

    return background_grid.outline()