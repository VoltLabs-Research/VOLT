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
    parser.add_argument('--defect-threshold', type=float, default=0.15,  help='Threshold for detecting defective atoms')
    parser.add_argument('--smooth-mesh', action='store_true', default=True, help='Apply smoothing to the interface mesh before core marking')
    parser.add_argument('--timestep', type=int, default=None, help='Specific timestep to analyze (default: first)')
    parser.add_argument('--cutoff', type=float, default=3.5, help='Cutoff distance for neighbor search')
    parser.add_argument('--num-neighbors', type=int, default=12, help='Number of Voronoi neighbors')
    parser.add_argument('--min-neighbors', type=int, default=12, help='Minimum neighbors for surface filtering')
    parser.add_argument('--voronoi-factor', type=float, default=1.5, help='Factor to expand cutoff for Voronoi candidate pool')
    parser.add_argument('--tolerance', type=float, default=0.3, help='Tolerance for lattice connectivity matching')
    parser.add_argument('--max-loop-length', type=int, default=16, help='Maximum length for Burgers circuit detection')
    parser.add_argument('--burgers-threshold', type=float, default=1e-4, help='Threshold magnitude to consider Burgers vectors non-zero')
    parser.add_argument('--orientation-threshold', type=float, default=0.1, help='Threshold for quaternion similarity in cluster building (used in step_build_clusters)')
    parser.add_argument('--min-cluster-size', type=int, default=5, help='Minimum number of atoms required to form a valid crystal orientation cluster')
    parser.add_argument('--core-radius', type=float, default=2.0, help='Radius for marking dislocation cores (in Angstroms)')
    # Crystal structure and analysis options
    parser.add_argument(
        "--crystal-type",
        type=str.upper,
        choices=["FCC", "HCP", "BCC", "ICO", "SC"],
        default=None,
        help=(
            "Type of crystal for the simulation. If provided, "
            "The DXA will directly use that template (e.g. FCC, HCP, BCC, ICO or SC). "
            "If not specified, it will be automatically inferred with PTM/CNA."
        )
    )
    parser.add_argument('--lattice-parameter', type=float, default=4.0, help='Lattice parameter in Angstroms')
    # TODO: implement adaptative cutoff form PTM.
    parser.add_argument('--adaptive-cutoff', action='store_true', default=False,help='Enable adaptive cutoff for neighbor search (recommended for distorted structures)')
    parser.add_argument('--allow-non-standard-burgers', action='store_true', default=True, help='Allow detection of non-standard Burgers vectors')
    parser.add_argument('--validation-tolerance', type=float, default=0.35, help='Tolerance for Burgers vector validation (increased for HCP compatibility)')
    parser.add_argument('--ghost-thickness', type=float, default=1.5, help='Thickness of ghost region around interface mesh or dislocation core (in Angstroms)')
    parser.add_argument('--output', '-o', default='dislocations.json', help='Output JSON file for dislocations')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose logging')
    parser.add_argument('--use-cna', action='store_true', help='Enable verbose logging')
    # TODO: Implement neighbor tolerance for PTM.
    parser.add_argument('--neighbor-tolerance', type=float, default=0.1, help='Relative tolerance for neighbor distance comparison (used in CNA/PTM)')
    parser.add_argument('--track-dir', type=str, default=None, help='If set, perform dislocation tracking and statistics from this directory of JSON files')
    parser.add_argument('--fast-mode', action='store_true', help='Enable fast mode (skips some analysis steps for speed)')
    parser.add_argument('--max-loops', type=int, default=1000, help='Maximum number of loops to find (lower = faster)')
    parser.add_argument('--max-connections-per-atom', type=int, default=6, help='Maximum connections per atom (lower = faster)')
    parser.add_argument('--loop-timeout', type=int, default=60, help='Timeout for loop finding in seconds')
    parser.add_argument('--line-threshold', type=float, default=0.1, help='Threshold used when building dislocation lines from grouped loops')

    # Segment generation options
    parser.add_argument('--include-segments', action='store_true', default=True, help='Include dislocation segments in JSON export')
    parser.add_argument('--segment-length', type=float, default=None, help='Target length for dislocation segments (auto-calculated if not set)')
    parser.add_argument('--min-segments', type=int, default=5, help='Minimum number of segments per dislocation line')
    parser.add_argument('--no-segments', action='store_true', help='Disable segment generation for faster export')
    parser.add_argument('--line-smoothing-level', type=int, default=3, help='Level of smoothing applied to dislocation lines (higher = smoother, 0 = none)')

    parser.add_argument('--line-point-interval', type=float, default=1.0, help='Interval in Angstroms between sampled points along dislocation lines')

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