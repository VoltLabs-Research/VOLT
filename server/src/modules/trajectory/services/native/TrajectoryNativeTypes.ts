import { Readable } from 'node:stream';

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

export interface LineStyleFilterParam {
    property: string;
    operator: 'gte' | 'lte' | 'eq' | 'neq';
    value: number | string;
};

export interface LineStyleParams {
    lineWidth?: number;
    tubularSegments?: number;
    colorMode?: 'category' | 'uniform' | 'gradient';
    colorProperty?: string;
    categoryColors?: Record<string, [number, number, number, number]>;
    categoryVisibility?: Record<string, boolean>;
    uniformColor?: [number, number, number, number];
    gradient?: string;
    startValue?: number;
    endValue?: number;
    filters?: LineStyleFilterParam[];
};

export interface LineExportBaseOptions {
    lineWidth?: number;
    tubularSegments?: number;
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
    material?: Record<string, unknown>;
};

export interface TrajectoryNativeLineModelResponse {
    objectKey: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
};

export interface TrajectoryNativeObjectStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
};
