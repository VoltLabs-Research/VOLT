export interface FrameMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: {
        boundingBox: {
            width: number;
            height: number;
            length: number;
        };
        geometry: {
            cell_vectors: number[][];
            cell_origin: number[];
            periodic_boundary_conditions: {
                x: boolean;
                y: boolean;
                z: boolean;
            };
        };
    };
}

export interface AtomPageEntry {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
}

export interface AtomPageResult {
    atoms: AtomPageEntry[];
    totalAtoms: number;
    nativeProperties: string[];
    analysisPropertyNames?: string[];
    analysisAtoms?: Record<string, unknown>[];
}
