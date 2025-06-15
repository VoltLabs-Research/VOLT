from opendxa.visualizers import DislocationVisualizer, VisualizationSettings
from opendxa import DislocationAnalysis

pipeline = DislocationAnalysis()

# pipeline.compute(dump_file, output_file)
pipeline.set_circuit_sizes(50, 256)
pipeline.set_smoothing_params(100, 100, 100)
analysis = pipeline.compute('/home/rodyherrera/Desktop/tmp/OpenDXA/examples/820000_scratch_6m_atoms.dump', 'dislocations.vtk')

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

# dislocation_visualizer.to_vtk(filename)

# These are the default values. If you don't specify a cutoff value, it will be 
# calculated as an estimate.
#
# pipeline.set_circuit_sizes(9, 16)
# pipeline.set_smoothing_params(8, 4, 4)
# pipeline.set_cutoff(3.5)
# pipeline.set_pbc(True, True, False)
# pipeline.set_sf_flatten(0.3)
# pipeline.set_atom_offset(0.1, 0.2, 0.3)
# pipeline.set_scale_factors(1.05, 1.05, 1.0)