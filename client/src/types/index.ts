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

export interface TimestepSelectorProps {
    fileId: string;
    selectedTimestep?: number;
    onTimestepSelect: (timestep: number | undefined) => void;
}

export interface ExtendedTimestepViewerProps extends TimestepViewerProps {
    timestepData?: any;
    loading?: boolean;
    error?: string | null;
}

export interface DislocationVisualizerProps{
    dislocations: Dislocation[];
    selectedDislocationId?: string;
    visible?: boolean;
    scale?: number;
}

export interface FileListProps {
    onFileSelect: (file: FileInfo) => void;
    selectedFile?: FileInfo;
    refreshTrigger?: number;
}

export interface EditorWidgetProps {
    children: React.ReactNode;
    className?: string;
}

export interface TimestepControlsProps {
    fileInfo: FileInfo | null;
    timesteps: number[];
    currentTimestep: number;
    onTimestepChange: (timestep: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    playSpeed: number;
    onSpeedChange: (speed: number) => void;
    isConnected: boolean;
    isStreaming: boolean;
    streamProgress?: { current: number; total: number } | null;
    onStartPreloading: () => void;
    onStopPreloading: () => void;
    preloadedCount: number;
}

export interface DislocationAnalyzerProps {
    selectedFile: FileInfo;
    currentTimestep: number;
    showDislocationAnalysis: boolean;
    onDislocationVisualize?: (dislocation: Dislocation) => void;
    isAnalyzing: boolean;
    analysis: AnalysisResult | null;
    onClearAnalysis: () => void;
    onLoadDefaultConfig: () => Promise<void>;
}

export interface TimestepData{
    positions: number[][];
    atom_types: number[];
    atoms_count: number;
    box_bounds: number[][];
}

export interface DislocationResultsProps{
    analysis: AnalysisResult;
    onDislocationSelect?: (dislocation: Dislocation) => void;
    selectedDislocationId?: string;
}

export interface TimestepViewerProps{
    fileInfo: FileInfo;
    currentTimestep: number;
    isPlaying: boolean;
    playSpeed: number;
    timesteps: number[];
    onTimestepChange: (timestep: number) => void;
}

export interface TimestepData {
    timestep: number;
    atoms_count: number;
    positions: number[][];
    atom_types: number[];
    box_bounds: number[][] | null;
    error?: string;
}

export interface WebSocketMessage {
    type: string;
    file_id?: string;
    data?: any;
    error?: string;
    message?: string;
    timestep?: number;
    total_timesteps?: number;
    batch_index?: number;
    total_batches?: number;
    progress?: {
        current: number;
        total: number;
    };
}

export interface UseWebSocketReturn {
    isConnected: boolean;
    connectionError: string | null;
    startStream: (options?: StreamOptions) => void;
    stopStream: () => void;
    getTimestep: (timestep: number) => void;
    isStreaming: boolean;
    progress: { current: number; total: number } | null;
    receivedData: TimestepData[];
    clearData: () => void;
    connectionInfo: any;
}

export interface StreamOptions {
    includePositions?: boolean;
    batchSize?: number;
    delayMs?: number;
    startTimestep?: number;
    endTimestep?: number;
}