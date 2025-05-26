from opendxa.parser import LammpstrjParser
from opendxa.export import DislocationTracker
from opendxa.utils.ptm_templates import get_ptm_templates
from opendxa.utils.logging import setup_logging
from opendxa.core import analyze_timestep, init_worker
from concurrent.futures import ProcessPoolExecutor
from functools import partial
import argparse
import logging

logger = logging.getLogger() 

def parse_call_args():
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
    parser.add_argument('--max-loop-length', type=int, default=16, help='Maximum length for Burgers circuit detection')
    parser.add_argument('--burgers-threshold', type=float, default=1e-3, help='Threshold magnitude to consider Burgers vectors non-zero')
    
    # Crystal structure and analysis options
    parser.add_argument('--crystal-type', type=str, default='fcc', choices=['fcc', 'bcc', 'hcp', 'auto'], 
                       help='Crystal structure type (auto = detect from PTM analysis)')
    parser.add_argument('--lattice-parameter', type=float, default=4.0, help='Lattice parameter in Angstroms')
    parser.add_argument('--allow-non-standard-burgers', action='store_true', default=True,
                       help='Allow detection of non-standard Burgers vectors')
    parser.add_argument('--validation-tolerance', type=float, default=0.35, 
                       help='Tolerance for Burgers vector validation (increased for HCP compatibility)')
    
    parser.add_argument('--output', '-o', default='dislocations.json', help='Output JSON file for dislocations')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose logging')
    parser.add_argument('--track-dir', type=str, default=None, help='If set, perform dislocation tracking and statistics from this directory of JSON files')
    parser.add_argument('--fast-mode', action='store_true', help='Enable fast mode (skips some analysis steps for speed)')
    parser.add_argument('--max-loops', type=int, default=1000, help='Maximum number of loops to find (lower = faster)')
    parser.add_argument('--max-connections-per-atom', type=int, default=6, help='Maximum connections per atom (lower = faster)')
    parser.add_argument('--loop-timeout', type=int, default=60, help='Timeout for loop finding in seconds')

    return parser.parse_args()

def main():
    args = parse_call_args()
    setup_logging(args.verbose)

    if args.track_dir:
        logger.info(f'Tracking dislocations from directory: {args.track_dir}')
        tracker = DislocationTracker(args.track_dir)
        tracker.load_all_timesteps()
        tracker.compute_statistics()
        tracker.plot_burgers_histogram()
        tracker.track_dislocations()
        return 
    
    logger.info(f'Using "{args.lammpstrj}"')
    logger.info(f'Loading lammpstrj file "{args.lammpstrj}"')

    templates, templates_size = get_ptm_templates()
    
    def filter_timesteps(iterable, timestep=None):
        for data in iterable:
            if timestep is not None and data['timestep'] != timestep:
                continue
            yield data

    lammpstrj = LammpstrjParser(args.lammpstrj)
    timesteps_iter = filter_timesteps(lammpstrj.iter_timesteps(), args.timestep)

    with ProcessPoolExecutor(
        max_workers=args.workers,
        initializer=init_worker,
        initargs=(templates, templates_size)
    ) as executor:
        executor.map(
            partial(analyze_timestep, args=args),
            timesteps_iter
        )

if __name__ == '__main__':
    main()