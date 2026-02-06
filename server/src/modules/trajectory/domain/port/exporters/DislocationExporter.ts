import { ExportMaterial } from './ExportMaterial';

export interface ProcessedDislocationGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
};

export interface DislocationExportOptions{
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: ExportMaterial;
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    };
};

export interface IDislocationExporter{
    toStorage(
        data: any,
        objectName: string,
        options?: DislocationExportOptions
    ): Promise<void>;
};