from opendxa.visualizers import DislocationVisualizer, VisualizationSettings
from opendxa.utils import load_analysis

analysis = load_analysis('/home/rodyherrera/Desktop/tmp/OpenDXA/debug.analysis_2.json')

settings = VisualizationSettings(
    line_width=3.0,
    colormap='plasma',
    show_atoms=False,
    show_stacking_faults=False,
    show_interface=False,
    show_grid=True,
    point_size=0.2
)

dislocation_visualizer = DislocationVisualizer(analysis, settings)
dislocation_visualizer.visualize()
dislocation_visualizer.print_stats()