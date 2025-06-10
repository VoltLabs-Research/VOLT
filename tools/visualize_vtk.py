from bindings.python.visualizers.vtk import DislocationVTKReader
import argparse
import os
import sys

parser = argparse.ArgumentParser(description='Dislocation VTK Reader')
parser.add_argument('vtk_file', help='VTK file')
args = parser.parse_args()

if not os.path.exists(args.vtk_file):
    print(f'File {args.vtk_file} not found.')
    sys.exit(1)

colors = [
    '#FF6B6B',
   '#4ECDC4', 
   '#45B7D1',
   '#F9CA24',
   '#6C5CE7',
   '#FD79A8',
   '#FDCB6E',
   '#55A3FF',
   '#26de81',
   '#A0E7E5' 
]

reader = DislocationVTKReader(args.vtk_file, colors=colors)
reader.plot_dislocations()
reader.plot_projections()