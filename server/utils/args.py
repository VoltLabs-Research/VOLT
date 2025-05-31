from server.models.analysis_config import AnalysisConfig

def args_from_config(config: AnalysisConfig, output_file: str = 'temp_output.json') -> object:
    '''Convert AnalysisConfig to args object compatible with OpenDXA'''
    class Args:
        pass
    
    args = Args()
    
    args.cutoff = config.cutoff
    args.num_neighbors = config.num_neighbors
    args.min_neighbors = config.min_neighbors
    args.voronoi_factor = config.voronoi_factor
    args.tolerance = config.tolerance
    args.max_loop_length = config.max_loop_length
    args.burgers_threshold = config.burgers_threshold
    args.crystal_type = config.crystal_type
    args.lattice_parameter = config.lattice_parameter
    args.allow_non_standard_burgers = config.allow_non_standard_burgers
    args.validation_tolerance = config.validation_tolerance
    args.fast_mode = config.fast_mode
    args.max_loops = config.max_loops
    args.max_connections_per_atom = config.max_connections_per_atom
    args.loop_timeout = config.loop_timeout
    args.include_segments = config.include_segments and not config.no_segments
    args.segment_length = config.segment_length
    args.min_segments = config.min_segments
    args.no_segments = config.no_segments
    args.workers = 1
    args.output = output_file
    args.verbose = False
    args.track_dir = None
    
    return args