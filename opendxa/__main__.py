from opendxa.core.analysis_config import AnalysisConfig
from opendxa.core.engine import DislocationAnalysis
import argparse

def parse_call_args() -> AnalysisConfig:
    parser = argparse.ArgumentParser(
        description='Open Source Dislocation Extraction Algorithm (OpenDXA)'
    )
    parser.add_argument('lammpstrj', help='Path to LAMMPS lammpstrj file')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--defect-threshold', type=float, default=0.15,  help='Threshold for detecting defective atoms')
    parser.add_argument('--smooth-mesh', action='store_true', default=True, help='Apply smoothing to interface mesh')
    parser.add_argument('--timestep', type=int, default=None, help='Specific timestep to analyze (default: first)')
    parser.add_argument('--cutoff', type=float, default=3.5, help='Cutoff distance for neighbor search')
    parser.add_argument('--num-neighbors', type=int, default=12, help='Number of Voronoi neighbors')
    parser.add_argument('--min-neighbors', type=int, default=12, help='Min. neighbors for surface filtering')
    parser.add_argument('--voronoi-factor', type=float, default=1.5, help='Factor to expand cutoff for Voronoi')
    parser.add_argument('--tolerance', type=float, default=0.3, help='Tolerance for lattice connectivity matching')
    parser.add_argument('--max-loop-length', type=int, default=16, help='Max length for Burgers circuit detection')
    parser.add_argument('--burgers-threshold', type=float, default=1e-4, help='Threshold for Burgers vector módulo')
    parser.add_argument('--orientation-threshold', type=float, default=0.1, help='Threshold for clustering (PTM/CNA)')
    parser.add_argument('--min-cluster-size', type=int, default=5, help='Min. atoms para cluster')
    parser.add_argument('--core-radius', type=float, default=2.0, help='Radio para core marking (Å)')
    parser.add_argument(
        "--crystal-type",
        type=str.upper,
        choices=["FCC", "HCP", "BCC", "ICO", "SC"],
        default=None,
        help="Tipo de cristal (FCC, HCP, BCC, ICO o SC). Si no, se infiere."
    )
    parser.add_argument('--lattice-parameter', type=float, default=4.0, help='Parámetro de red (Å)')
    parser.add_argument('--adaptive-cutoff', action='store_true', default=False,help='Enable adaptive cutoff')
    parser.add_argument('--spacetime-heatmap', action='store_true', default=False,help='Constructs and displays a heat map where the x-axis is the timestep and the y-axis is the position along z (in bins). The color indicates how many lines have their centroid in that z-range for each timestep.')
    parser.add_argument('--allow-non-standard-burgers', action='store_true', default=True, help='Detect non-standard Burgers')
    parser.add_argument('--validation-tolerance', type=float, default=0.35, help='Tolerance para validación Burgers')
    parser.add_argument('--ghost-thickness', type=float, default=1.5, help='Ghost thickness (Å)')
    parser.add_argument('--output', '-o', default='dislocations.json', help='Archivo JSON de salida')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose logging')
    parser.add_argument('--use-cna', action='store_true', help='Usar CNA en lugar de PTM')
    parser.add_argument('--neighbor-tolerance', type=float, default=0.1, help='Tolerancia relativa de vecinos')
    parser.add_argument('--track-dir', type=str, default=None, help='Directorio de JSON para tracking')
    parser.add_argument('--fast-mode', action='store_true', help='Enable fast mode (skip steps)')
    parser.add_argument('--max-loops', type=int, default=1000, help='Max loops to find')
    parser.add_argument('--max-connections-per-atom', type=int, default=6, help='Max conexiones por átomo')
    parser.add_argument('--loop-timeout', type=int, default=60, help='Timeout para loops (s)')
    parser.add_argument('--line-threshold', type=float, default=0.1, help='Threshold para líneas dislocación')
    parser.add_argument('--include-segments', action='store_true', default=True, help='Incluir segmentos en JSON')
    parser.add_argument('--segment-length', type=float, default=None, help='Longitud objetivo de segmento (auto)')
    parser.add_argument('--min-segments', type=int, default=5, help='Min segmentos por línea')
    parser.add_argument('--no-segments', action='store_true', help='No generar segmentos (más rápido)')
    parser.add_argument('--line-smoothing-level', type=int, default=3, help='Nivel de suavizado de líneas')
    parser.add_argument('--line-point-interval', type=float, default=1.0, help='Intervalo (Å) entre puntos en línea')

    args = parser.parse_args()

    config = AnalysisConfig(
        lammpstrj=args.lammpstrj,
        spacetime_heatmap=args.spacetime_heatmap,
        workers=args.workers,
        defect_threshold=args.defect_threshold,
        smooth_mesh=args.smooth_mesh,
        timestep=args.timestep,
        cutoff=args.cutoff,
        num_neighbors=args.num_neighbors,
        min_neighbors=args.min_neighbors,
        voronoi_factor=args.voronoi_factor,
        tolerance=args.tolerance,
        max_loop_length=args.max_loop_length,
        burgers_threshold=args.burgers_threshold,
        orientation_threshold=args.orientation_threshold,
        min_cluster_size=args.min_cluster_size,
        core_radius=args.core_radius,
        crystal_type=args.crystal_type,
        lattice_parameter=args.lattice_parameter,
        adaptive_cutoff=args.adaptive_cutoff,
        allow_non_standard_burgers=args.allow_non_standard_burgers,
        validation_tolerance=args.validation_tolerance,
        ghost_thickness=args.ghost_thickness,
        # output=args.output,
        verbose=args.verbose,
        use_cna=args.use_cna,
        neighbor_tolerance=args.neighbor_tolerance,
        track_dir=args.track_dir,
        fast_mode=args.fast_mode,
        max_loops=args.max_loops,
        max_connections_per_atom=args.max_connections_per_atom,
        loop_timeout=args.loop_timeout,
        line_threshold=args.line_threshold,
        include_segments=args.include_segments,
        segment_length=args.segment_length,
        min_segments=args.min_segments,
        no_segments=args.no_segments,
        line_smoothing_level=args.line_smoothing_level,
        line_point_interval=args.line_point_interval,
    )

    return config

def main():
    config = parse_call_args()

    analysis = DislocationAnalysis(config)
    analysis.run()

if __name__ == '__main__':
    main()
