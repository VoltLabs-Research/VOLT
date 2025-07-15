import pyvista as pv
import sys

vtk_file = sys.argv[1]

mesh = pv.read(vtk_file)
mesh.plot(scalars="dislocation_segment", show_edges=True)