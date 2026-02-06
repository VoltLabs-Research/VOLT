
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

export interface ParseResult {
    metadata: FrameMetadata;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: { [name: string]: Float32Array };
    min: [number, number, number];
    max: [number, number, number];
}

export interface ParseOptions {
    includeIds?: boolean;
    properties?: string[];
}

export interface NativeDataResult {
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    metadata: {
        timestep: number;
        natoms: number;
        headers: string[];
    };
    min: [number, number, number];
    max: [number, number, number];
}
