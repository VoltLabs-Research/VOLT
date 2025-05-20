from concurrent.futures import ProcessPoolExecutor
from functools import partial

from opendxa.parser import LammpstrjParser
from opendxa.neighbors import HybridNeighborFinder
from opendxa.export import DislocationExporter, DislocationTracker
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.filters import FilteredLoopFinder, LoopGrouper, LoopCanonicalizer
from opendxa.classification import (
    PTMLocalClassifier,
    SurfaceFilter,
    LatticeConnectivityGraph,
    DisplacementFieldAnalyzer,
    BurgersCircuitEvaluator,
    ClassificationEngine,
    DislocationLineBuilder
)

import numpy as np
import argparse
import logging
import time
import psutil

handler = logging.StreamHandler()
formatter = logging.Formatter(
    '%(asctime)s %(processName)s %(levelname)s ▶ %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
handler.setFormatter(formatter)
logger = logging.getLogger() 
logger.addHandler(handler)

# TEMPLATES, TEMPLATE_SIZES = get_ptm_templates()

def init_worker(templates, template_sizes):
    global TEMPLATES, TEMPLATE_SIZES
    TEMPLATES = templates
    TEMPLATE_SIZES = template_sizes

def analyze_timestep(data, arguments):
    try:
        process = psutil.Process()

        timestep = data['timestep']
        positions = data['positions']
        box = data['box']
        ids = data['ids']
        number_of_atoms = len(positions)

        time_start = time.perf_counter()
        memory_start = process.memory_info().rss / 1024 ** 2


        logger.info(
            f'Timestep {timestep}: {number_of_atoms} atoms'
            f'(memory {memory_start:.1f} MiB)'
        )

        logging.getLogger('numba.cuda.cudadrv.driver').setLevel(logging.WARNING)

        t0 = time.perf_counter()
        neighbor_finder = HybridNeighborFinder(
            positions=positions,
            cutoff=arguments.cutoff,
            num_neighbors=arguments.num_neighbors,
            voronoi_factor=arguments.voronoi_factor,
            max_neighbors=arguments.num_neighbors * 2,
            box_bounds=box
        )
        neighbors = neighbor_finder.find_neighbors()
        dt = time.perf_counter() - t0
        total_pairs = sum(len(v) for v in neighbors.values())
        logger.info(f'Neighbors: {total_pairs} pairs found in {dt:.3f}s')

        # Local structure classification
        t0 = time.perf_counter()
        ptm_classifier = PTMLocalClassifier(
            positions=positions,
            box_bounds=box,
            neighbor_dict=neighbors,
            templates=TEMPLATES,
            template_sizes=TEMPLATE_SIZES,
            max_neighbors=TEMPLATE_SIZES.max()
        )
        types, quaternions = ptm_classifier.classify()
        dt = time.perf_counter() - t0
        unique, counts = np.unique(types, return_counts=True)
        type_stats = ', '.join(f'{u}:{c}' for u, c in zip(unique, counts))
        logger.info(f'PTM classified in {dt:.3f}s: types {{{type_stats}}}')

        # Surface filtering
        surface = SurfaceFilter(min_neighbors=arguments.min_neighbors)
        t0 = time.perf_counter()
        data_filtered = surface.filter_data(
            positions=positions,
            ids=ids,
            neighbors=neighbors,
            ptm_types=types,
            quaternions=quaternions
        )
        dt = time.perf_counter() - t0
        n_interior = data_filtered['positions'].shape[0]
        logger.info(f'Surface Filter: {n_interior} interior atoms in {dt:.3f}s')

        # Connectivity graph
        t0 = time.perf_counter()
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
        dt = time.perf_counter() - t0
        n_edges = sum(len(v) for v in connectivity.values())//2
        logger.info(f'Graph: {n_edges} edges in {dt:.3f}s')

        # Displacement field
        t0 = time.perf_counter()
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
        dt = time.perf_counter() - t0
        logger.info(
            f'Displacements: average of magnitudes '
            f'{np.nanmean(avg_mags):.3f} in {dt:.3f}s'
        )
        
        # Burgers circuits
        t0 = time.perf_counter()
        loop_finder = FilteredLoopFinder(connectivity, positions, max_length=8)
        filtered_loops = loop_finder.find_minimal_loops()

        # Canonicalize loops to avoid redundancy
        canonicalizer = LoopCanonicalizer(
            positions=data_filtered['positions'],
            box_bounds=box
        )
        canonical_loops = canonicalizer.canonicalize(filtered_loops)

        # Calculate Burgers vectors
        burgers_circuits = BurgersCircuitEvaluator(
            connectivity=connectivity,
            positions=data_filtered['positions'],
            ptm_types=data_filtered['ptm_types'],
            quaternions=data_filtered['quaternions'],
            templates=TEMPLATES,
            template_sizes=TEMPLATE_SIZES,
            box_bounds=box
        )
        burgers_circuits.loops = canonical_loops
        raw_burgers = burgers_circuits.calculate_burgers()

        # Group similar loops
        grouper = LoopGrouper(raw_burgers, canonical_loops, positions)
        groups = grouper.group_loops()

        # Consolidate into single loops
        final_loops = []
        final_burgers = {}
        for gid, group in enumerate(groups):
            all_pts = []
            avg_burg = np.zeros(3, dtype=np.float32)
            for idx in group:
                all_pts.extend(canonical_loops[idx])
                avg_burg += raw_burgers[idx]
            avg_burg /= len(group)
            final_loops.append(sorted(set(all_pts)))
            final_burgers[gid] = avg_burg
            
        builder = DislocationLineBuilder(
            positions=data_filtered['positions'],
            loops=final_loops,
            burgers=final_burgers,
            threshold=0.1
        )
        lines = builder.build_lines()
        dt = time.perf_counter() - t0
        logger.info(f'Burgers and lines: {len(lines)} lines in {dt:.3f}s')

        # Classify each line
        engine = ClassificationEngine(
            positions=data_filtered['positions'],
            loops=final_loops,
            burgers_vectors=final_burgers
        )
        line_types = engine.classify()

        t0 = time.perf_counter()
        exporter = DislocationExporter(
            positions=data_filtered['positions'],
            loops=final_loops,
            burgers=final_burgers,
            timestep=timestep,
            line_types=line_types
        )
        exporter.to_json(arguments.output)
        dt = time.perf_counter() - t0
        logger.info(f'Export to "{arguments.output}" in {dt:.3f}s')

        total_time = time.perf_counter() - time_start
        memory_end = process.memory_info().rss / 1024 ** 2
        total_memory = memory_end - memory_start

        logger.info(
            f'Timestep {timestep} completed in {total_time:.3f}s '
            f'(Memory {memory_end:.1f} MiB, total: {total_memory:+.1f} MiB)\n'
        )
    except Exception as e:
        logger.error(f'Error in timestep {data["timestep"]}: {e}', exc_info=True)

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
    parser.add_argument('--track-dir', type=str, default=None, help='If set, perform dislocation tracking and statistics from this directory of JSON files')

    return parser.parse_args()

def main():
    arguments = parse_call_arguments()
    logger.setLevel(logging.DEBUG if arguments.verbose else logging.INFO)

    if arguments.track_dir:
        logger.info(f'Tracking dislocations from directory: {arguments.track_dir}')
        tracker = DislocationTracker(arguments.track_dir)
        tracker.load_all_timesteps()
        tracker.compute_statistics()
        tracker.plot_burgers_histogram()
        tracker.track_dislocations()
        return 
    
    logger.info(f'Using "{arguments.lammpstrj}"')
    logger.info(f'Loading lammpstrj file "{arguments.lammpstrj}"')

    templates, templates_size = get_ptm_templates()
    
    def filter_timesteps(iterable, timestep=None):
        for data in iterable:
            if timestep is not None and data['timestep'] != timestep:
                continue
            yield data

    lammpstrj = LammpstrjParser(arguments.lammpstrj)
    timesteps_iter = filter_timesteps(lammpstrj.iter_timesteps(), arguments.timestep)

    # for ts in timesteps_iter:
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