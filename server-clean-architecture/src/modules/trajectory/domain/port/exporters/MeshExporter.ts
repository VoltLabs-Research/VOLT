import { ExportMaterial } from './ExportMaterial';

export interface ProcessedMesh{
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
};

export interface Mesh{
    data: {
        points: {
            index: number;
            position: [number, number, number];
        }[];
        facets: {
            vertices: [number, number, number];
        }[];
        metadata: any;
    };
};

export interface DefectMeshExportOptions{
    generateNormals?: boolean;
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: ExportMaterial;
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    }
};

export interface IMeshExporter{
    toStorage(
        mesh: Mesh,
        objectName: string,
        options?: DefectMeshExportOptions
    ): Promise<void>;
};