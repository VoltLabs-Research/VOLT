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

TEMPLATES, TEMPLATE_SIZES = get_ptm_templates()

def init_worker(templates, template_sizes):
    global TEMPLATES, TEMPLATE_SIZES
    TEMPLATES = templates
    TEMPLATE_SIZES = template_sizes

def analyze_timestep(data, arguments):
    timestep = data['timestep']
        
    positions = data['positions']
    box = data['box']
    ids = data['ids']
    number_of_atoms = len(positions)

    logging.info(f'Analyzing timestep {timestep} ({number_of_atoms} atoms)')
    logging.getLogger('numba.cuda.cudadrv.driver').setLevel(logging.WARNING)

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
        templates=TEMPLATES,
        template_sizes=TEMPLATE_SIZES,
        max_neighbors=TEMPLATE_SIZES.max()
    )

    types, quaternions = ptm_classifier.classify()

    # Surface filtering
    surface = SurfaceFilter(min_neighbors=arguments.min_neighbors)
    interior_idxs = surface.filter_indices(neighbors, ptm_types=types)

    data_filtered = surface.filter_data(
        positions=positions,
        ids=ids,
        neighbors=neighbors,
        ptm_types=types,
        quaternions=quaternions
    )

    # Connectivity graph
    connectivity_graph = LatticeConnectivityGraph(
        positions=data_filtered['positions'],
        ids=data_filtered['ids'],
        neighbors=data_filtered['neighbors'],
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=TEMPLATES,
        template_sizes=TEMPLATE_SIZES,
        tolerance=arguments.tolerance
    )

    connectivity = connectivity_graph.build_graph()

    # Displacement field
    displacement_field_analyzer = DisplacementFieldAnalyzer(
        positions=data_filtered['positions'],
        connectivity=connectivity,
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=TEMPLATES,
        template_sizes=TEMPLATE_SIZES,
        box_bounds=box
    )

    disp_vecs, avg_mags = displacement_field_analyzer.compute_displacement_field()
    
    # Burgers circuits
    burgers_circuits = BurgersCircuitEvaluator(
        connectivity=connectivity,
        positions=data_filtered['positions'],
        ptm_types=data_filtered['ptm_types'],
        quaternions=data_filtered['quaternions'],
        templates=TEMPLATES,
        template_sizes=TEMPLATE_SIZES,
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
    logging.info(f'Using "{arguments.lammpstrj}"')
    logging.info(f'Loading lammpstrj file "{arguments.lammpstrj}"')

    templates, templates_size = get_ptm_templates()
    
    def filter_timesteps(iterable, timestep=None):
        for data in iterable:
            if timestep is not None and data['timestep'] != timestep:
                continue
            yield data

    lammpstrj = LammpstrjParser(arguments.lammpstrj)
    timesteps_iter = filter_timesteps(lammpstrj.iter_timesteps(), arguments.timestep)

    #for ts in timesteps_iter:
    #    analyze_timestep(ts, arguments)

    with ProcessPoolExecutor(
        max_workers=arguments.workers,
        initializer=init_worker,
        initargs=(templates, templates_size)
    ) as executor:
        executor.map(
            partial(analyze_timestep, arguments=arguments),
            timesteps_iter
        )

if __name__ == '__main__':
    main()