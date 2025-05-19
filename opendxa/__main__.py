from concurrent.futures import ProcessPoolExecutor
from functools import partial

from opendxa.parser import LammpstrjParser
from opendxa.neighbors import HybridNeighborFinder
from opendxa.export import DislocationExporter
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.classification import (
    PTMLocalClassifier,
    SurfaceFilter,
    LatticeConnectivityGraph,
    DisplacementFieldAnalyzer,
    BurgersCircuitEvaluator,
    ClassificationEngine,
    DislocationLineBuilder
)

import argparse
import logging

def analyze_timestep(data, arguments, templates, template_sizes):
    timestep = data['timestep']
        
    positions = data['positions']
    box = data['box']
    ids = data['ids']
    number_of_atoms = len(positions)

    logging.info(f'Analyzing timestep {timestep} ({number_of_atoms} atoms)')

    neighbor_finder = HybridNeighborFinder(
        positions=positions,
        cutoff=arguments.cutoff,
        num_neighbors=arguments.num_neighbors,
        voronoi_factor=arguments.voronoi_factor,
        max_neighbors=arguments.num_neighbors * 2,
        box_bounds=box
    )

    logging.info('Finding neighbors...')
    neighbors = neighbor_finder.find_neighbors()

    # Local structure classification
    ptm_classifier = PTMLocalClassifier(
        positions=positions,
        box_bounds=box,
        neighbor_dict=neighbors,
        templates=templates,
        template_sizes=template_sizes,
        max_neighbors=template_sizes.max()
    )

    types, quaternions = ptm_classifier.classify()

    # Surface filtering
    surface = SurfaceFilter(min_neighbors=arguments.min_neighbors)
    interior_idxs = surface.filter_indices(neighbors, ptm_types=types)
    print('Interior atom count:', len(interior_idxs))

    data_filtered = surface.filter_data(
        positions=positions,
        ids=ids,
        neighbors=neighbors,
        ptm_types=types,
        quaternions=quaternions
    )

    print('\n--- Filtered Data ---')
    print('Filtered positions (first 5):')
    print(data_filtered['positions'][:5])
    print('\nFiltered IDs:')
    print(data_filtered['ids'])
    print('\nFiltered neighbor lists (first 5):')
    for i in range(min(5, len(data_filtered['ids']))):
        print(f'  atom {data_filtered["ids"][i]} →', data_filtered['neighbors'][i])
    print('\nFiltered PTM types:')
    print(data_filtered['ptm_types'])
    print('\nFiltered orientation quaternions (first 5):')
    print(data_filtered['quaternions'][:5])

    # Connectivity graph
    connectivity_graph = LatticeConnectivityGraph(
        positions=data_filtered['positions'],
        ids=data_filtered['ids'],
        neighbors=data_filtered['neighbors'],
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=templates,
        template_sizes=template_sizes,
        tolerance=arguments.tolerance
    )

    connectivity = connectivity_graph.build_graph()

    # Displacement field
    displacement_field_analyzer = DisplacementFieldAnalyzer(
        positions=data_filtered['positions'],
        connectivity=connectivity,
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=box
    )

    disp_vecs, avg_mags = displacement_field_analyzer.compute_displacement_field()
    
    # Burgers circuits
    burgers_circuits = BurgersCircuitEvaluator(
        connectivity=connectivity,
        positions=data_filtered['positions'],
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=templates,
        template_sizes=template_sizes,
        box_bounds=box
    )

    # TODO: max_length=arguments.max_loop_length
    burgers = burgers_circuits.calculate_burgers()

    builder = DislocationLineBuilder(
        positions=data_filtered['positions'],
        loops=burgers_circuits.loops,
        burgers=burgers,
        threshold=0.1
    )
    lines = builder.build_lines()
    print('Number of dislocation lines:', len(lines))
    print('First line points:\n', lines[0])

    # Classify each line
    engine = ClassificationEngine(
        positions=data_filtered['positions'],
        loops=builder.loops,
        burgers_vectors=burgers
    )
    line_types = engine.classify()

    exporter = DislocationExporter(
        positions=data_filtered['positions'],
        loops=builder.loops,
        burgers=burgers,
        timestep=timestep,
        line_types=line_types
    )
    exporter.to_json(arguments.output)
    logging.info(f'Exported dislocations to "{arguments.output}"')
      
def parse_call_arguments():
    parser = argparse.ArgumentParser(
        description='Open Source Dislocation Extraction Algorithm'
    )

    parser.add_argument('lammpstrj', help='Path to LAMMPS lammpstrj file')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--timestep', type=int, default=None, help='Specific timestep to analyze (default: first)')
    parser.add_argument('--cutoff', type=float, default=3.5, help='Cutoff distance for neighbor search')
    parser.add_argument('--num-neighbors', type=int, default=12, help='Number of Voronoi neighbors')
    parser.add_argument('--min-neighbors', type=int, default=12, help='Minimum neighbors for surface filtering')
    parser.add_argument('--voronoi-factor', type=float, default=1.5, help='Factor to expand cutoff for Voronoi candidate pool')
    parser.add_argument('--tolerance', type=float, default=0.2, help='Tolerance for lattice connectivity matching')
    parser.add_argument('--max-loop-length', type=int, default=8, help='Maximum length for Burgers circuit detection')
    parser.add_argument('--burgers-threshold', type=float, default=1e-3, help='Threshold magnitude to consider Burgers vectors non-zero')
    parser.add_argument('--output', '-o', default='dislocations.json', help='Output JSON file for dislocations')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose logging')

    return parser.parse_args()

def main():
    arguments = parse_call_arguments()
    logging.basicConfig(level=logging.DEBUG if arguments.verbose else logging.INFO)
    logging.info(f'Using "{arguments.workers}" workers')
    logging.info(f'Loading lammpstrj file "{arguments.lammpstrj}"')

    lammpstrj = LammpstrjParser(arguments.lammpstrj)
    templates, templates_size = get_ptm_templates()
    
    tasks = []
    for data in lammpstrj.iter_timesteps():
        timestep = data['timestep']
        if arguments.timestep is not None and timestep != arguments.timestep:
            continue
        tasks.append(data)
    
    logging.info(f'Local timesteps to process: {len(tasks)}')

    with ProcessPoolExecutor(max_workers=arguments.workers) as executor:
        executor.map(partial(analyze_timestep, arguments=arguments, templates=templates, template_sizes=templates_size), tasks)
        
if __name__ == '__main__':
    main()