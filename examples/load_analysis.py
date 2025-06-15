from opendxa.visualizers import DislocationVisualizer, VisualizationSettings
from opendxa.utils import load_analyses

# Single file:
# analisis = next(load_analyses('analysis.json'))
#
# All files in memory
# all_analyses = list(load_analyses("/route/to/analyses/"))
#
# Streaming processing (low RAM consumption)
# for analisis in load_analyses("/ruta/a/dir"):
#     procesar(analisis)

analysis = next(load_analyses('/home/rodyherrera/Desktop/tmp/OpenDXA/debug.analysis.json'))

settings = VisualizationSettings(
    line_width=3.0,
    colormap='plasma',
    show_atoms=False,
    background_color='black',
    show_stacking_faults=True,
    show_interface=True,
    show_grid=False,
    dislocation_opacity=0.1,
    point_size=0.2
)

dislocation_visualizer = DislocationVisualizer(analysis, settings)
dislocation_visualizer.visualize()
dislocation_visualizer.print_stats()