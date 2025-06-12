from opendxa import DislocationAnalysis
from opendxa.visualizers.vtk import DislocationVTKReader

pipeline = DislocationAnalysis()

# pipeline.compute(dump_file, output_file)
pipeline.compute('dump_file', 'dislocations.vtk')

vtk_reader = DislocationVTKReader('dislocations.vtk')
vtk_reader.plot_dislocations()

# These are the default values. If you don't specify a cutoff value, it will be 
# calculated as an estimate, and I personally recommend not specifying it and relying on the estimate.
#
# pipeline.set_circuit_sizes(9, 16)
# pipeline.set_smoothing_params(8, 4, 4)
# pipeline.set_cutoff(3.5)
# pipeline.set_pbc(True, True, False)
# pipeline.set_sf_flatten(0.3)
# pipeline.set_atom_offset(0.1, 0.2, 0.3)
# pipeline.set_scale_factors(1.05, 1.05, 1.0)