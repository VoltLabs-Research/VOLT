from dataclasses import dataclass
from typing import Optional, Tuple, List

@dataclass
class AnalysisConfig:
    '''
    Configuration parameters for dislocation analysis.
    '''
    # LAMMPS trajectory file path
    lammpstrj: str

    # Number of parallel workers
    workers: int = 4

    # Threshold for detecting defective atoms
    defect_threshold: float = 0.15

    # Apply smoothing to the interface mesh before core marking
    smooth_mesh: bool = True

    # If set, analyze only this single timestep (None = all timesteps)
    timestep: Optional[int] = None

    # Neighbor search parameters
    cutoff: float = 3.5
    num_neighbors: int = 12
    min_neighbors: int = 12
    voronoi_factor: float = 1.5
    tolerance: float = 0.3

    # Burgers circuit parameters
    max_loop_length: int = 16
    burgers_threshold: float = 1e-4

    # Clustering parameters
    orientation_threshold: float = 0.1
    min_cluster_size: int = 5

    # Core marking radius (Angstroms)
    core_radius: float = 2.0

    # Crystal structure settings (auto-infer if None)
    # e.g. 'FCC', 'HCP', 'BCC', 'ICO', 'SC'
    crystal_type: Optional[str] = None
    lattice_parameter: float = 4.0
    adaptive_cutoff: bool = False
    allow_non_standard_burgers: bool = True
    validation_tolerance: float = 0.35
    ghost_thickness: float = 1.5

    # Output JSON file
    # output: str = 'dislocations.json'

    # Verbose logging
    verbose: bool = False

    # Use CNA instead of PTM
    use_cna: bool = False

    # Tolerance for neighbor distance comparison (CNA/PTM)
    neighbor_tolerance: float = 0.1

    # Directory for dislocation tracking (if any)
    track_dir: Optional[str] = None
    spacetime_heatmap: bool = False
    run_voxel_density: bool = False
    voxel_grid_size: Tuple[int, int, int] = (10, 10, 10)
    voxel_box_bounds: Optional[List[List[float]]] = None
    run_clustering: bool = False
    clustering_n_clusters: int = 3
    run_tortuosity: bool = False
    run_graph_topology: bool = False
    graph_topology_timesteps: Optional[List[int]] = None
    run_orientation: bool = False
    orientation_bins: int = 36

    run_burgers_histogram: bool = False
    # Fast mode settings
    fast_mode: bool = False
    max_loops: int = 1000
    max_connections_per_atom: int = 6
    loop_timeout: int = 60

    # Dislocation line parameters
    line_threshold: float = 0.1

    # Segment generation options
    include_segments: bool = True
    segment_length: Optional[float] = None
    min_segments: int = 5
    no_segments: bool = False
    line_smoothing_level: int = 3
    line_point_interval: float = 1.0