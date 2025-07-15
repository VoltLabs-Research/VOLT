import pyvista as pv
import sys

vtk_file = sys.argv[1]

mesh = pv.read(vtk_file)
mesh.plot(show_edges=True)