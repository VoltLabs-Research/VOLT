from pathlib import Path
from burgers_types import analyze_dislocation_data
from gltf import visualize_dislocations_and_mesh_vtk
import orjson
import os
import sys

analysis_dir = Path('/home/rodyherrera/Escritorio/opendxa-results/')
directories = os.listdir(analysis_dir)

visualize_dislocations_and_mesh_vtk(
    "/home/rodyherrera/OpenDXA/opendxa/x/xd.json", 
    tube_radius=0.8,       
    tube_resolution=32,
    smooth_lines=True,
    antialias=True,  
    show_points=False     
)

sys.exit(0)
print('Simulation Directories:', directories)

for simulation_name in directories:
    simulation_dir = analysis_dir.joinpath(simulation_name).absolute()
    print(f'\nProcessing {simulation_name} ({simulation_dir})')
    
    analysis_files = list(simulation_dir.rglob('*.json'))
    print(f'\nFound {len(analysis_files)} analysis files')
    
    for analysis_file in analysis_files:
        print(f'{str(analysis_file)[len(str(simulation_dir)):]}:')

        with open(analysis_file, 'rb') as file:
            data = orjson.loads(file.read())

        structure_counts = {}
        for atom in data['atoms']['data ']:
            type_name = atom['type_name']
            structure_counts[type_name] = structure_counts.get(type_name, 0) + 1
        
        # Should match with data['metadata']['atom_count']
        total_atoms = sum(structure_counts.values())
        for struct_name, count in structure_counts.items():
            percentage = (count / total_atoms) * 100
            print(f'    - {struct_name}: {count} ({percentage:.2f}%)')

        print('')

        metadata = data['metadata']
        for key in ['timestep', 'atom_count']:
            print(f'    - {key.replace('_', ' ').title()}: {metadata[key]}')

        print('')

        d_summary = data['dislocations']['summary']
        for key in dict(d_summary).keys():
            print(f'    - {key.replace('_', ' ').title()}: {d_summary[key]:.2f}')

        print('')

        analyze_dislocation_data(data)