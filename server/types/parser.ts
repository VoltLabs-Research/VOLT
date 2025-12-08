export interface FrameMetadata{
    timestep: number;
    natoms: number;
    boxBounds: {
        xlo: number;
        xhi: number;
        ylo: number;
        yhi: number;
        zlo: number;
        zhi: number;
    };
    headers: string[];
};

export interface ParseResult{
    metadata: FrameMetadata;
    positions: Float32Array;
    types: Uint16Array;
    ids?: Uint32Array;
    properties?: { [name: string]: Float32Array };
    min: [number, number, number];
    max: [number, number, number];
};

export interface ParseOptions {
    includeIds?: boolean;
    properties?: string[];
}