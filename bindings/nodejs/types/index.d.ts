export enum LatticeStructure {
    FCC = 0,
    BCC = 1,
    HCP = 2,
    CUBIC_DIAMOND = 3,
    HEX_DIAMOND = 4
}

export enum IdentificationMode {
    PTM = 0,
    CNA = 1
}

export interface ProgressInfo {
    completedFrames: number;
    totalFrames: number;
    frameResult?: AnalysisResult;
}

export type ProgressCallback = (progress: ProgressInfo) => void;

export interface AnalysisResult {
    is_failed?: boolean;
    error?: string;
    total_dislocations?: number;
    perfect_dislocations?: number;
    partial_dislocations?: number;
    dislocation_density?: number;
    analysis_time?: number;
    total_time?: number;
    timestep?: number;
    natoms?: number;
    burgers_vectors?: Array<{
        x: number;
        y: number;
        z: number;
    }>;
    segments?: Array<{
        id: number;
        length: number;
        burgers_vector: { x: number; y: number; z: number };
        points: Array<{ x: number; y: number; z: number }>;
    }>;
    [key: string]: any;
}

export interface TrajectoryResult {
    is_failed: boolean;
    error?: string;
    total_time: number;
    frames: AnalysisResult[];
}

export type ComputeCallback = (error: Error | null, result?: AnalysisResult) => void;
export type TrajectoryCallback = (error: Error | null, result?: TrajectoryResult) => void;

// Funciones del addon
export declare function compute(inputFile: string, outputFile?: string): AnalysisResult;

export declare function computeTrajectory(
    inputFiles: string[], 
    outputTemplate: string
): TrajectoryResult;

export declare function computeTrajectory(
    inputFiles: string[], 
    outputTemplate: string, 
    callback: TrajectoryCallback
): void;

export declare function setCrystalStructure(structure: LatticeStructure): void;
export declare function setMaxTrialCircuitSize(size: number): void;
export declare function setCircuitStretchability(stretch: number): void;
export declare function setOnlyPerfectDislocations(flag: boolean): void;
export declare function setMarkCoreAtoms(flag: boolean): void;
export declare function setLineSmoothingLevel(level: number): void;
export declare function setLinePointInterval(interval: number): void;
export declare function setDefectMeshSmoothingLevel(level: number): void;
export declare function setIdentificationMode(mode: IdentificationMode): void;
export declare function setProgressCallback(callback: ProgressCallback): void;
export declare function reset(): void;

export declare function isValidLatticeStructure(structure: number): boolean;
export declare function isValidIdentificationMode(mode: number): boolean;