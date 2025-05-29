export interface AnalysisConfig{
    cutoff: number;
    num_neighbors: number;
    min_neighbors: number;
    voronoi_factor: number;
    tolerance: number;
    max_loop_length: number;
    burgers_threshold: number;
    crystal_type: string;
    lattice_parameter: number;
    allow_non_standard_burgers: boolean;
    validation_tolerance: number;
    fast_mode: boolean;
    max_loops: number;
    max_connections_per_atom: number;
    loop_timeout: number;
    include_segments: boolean;
    segment_length?: number;
    min_segments: number;
    no_segments: boolean;
    workers: number;
}

export interface FileInfo {
    file_id: string;
    filename: string;
    size: number;
    total_timesteps: number;
    atoms_count: number;
    upload_time: number;
}

export interface AnalysisRequest{
    timestep?: number;
    config: AnalysisConfig;
}

export interface AnalysisResult{
    success: boolean;
    timestep: number;
    dislocations: Dislocation[];
    analysis_metadata: Record<string, any>;
    execution_time: number;
    error?: string;
}

export interface Dislocation {
    id: string;
    core_atoms: number[];
    line_points: number[][];
    burgers_vector: number[];
    length: number;
    type: number | string; // Server returns number (0=edge, 1=screw, 2=mixed, -1=undefined)
    segment_count?: number;
    loops?: DislocationLoop[];
}

export interface DislocationLoop {
    atoms: number[];
    burgers_vector: number[];
    center: number[];
    normal: number[];
    area: number;
}

export interface ServerStatus{
    status: string;
    uploaded_files: number;
    cached_results: number;
    version: string;
}

export interface UploadResult{
    filename: string;
    size: number;
    timesteps: number[];
    atoms_count: number;
    message: string;
}

export interface AtomPosition{
    x: number;
    y: number;
    z: number;
    type: number;
}

export interface TimestepData{
    positions: number[][];
    atom_types: number[];
    atoms_count: number;
    box_bounds: number[][];
}

export interface TimestepViewerProps{
    fileInfo: FileInfo;
    currentTimestep: number;
    isPlaying: boolean;
    playSpeed: number;
    timesteps: number[];
    onTimestepChange: (timestep: number) => void;
}