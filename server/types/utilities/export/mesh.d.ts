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
    }
}

export interface DefectMeshExportOptions{
    generateNormals?: boolean;
    enableDoubleSided?: boolean;
    smoothIterations?: number;
    material?: {
        baseColor: [number, number, number, number];
        metallic: number;
        roughness: number;
        emissive: [number, number, number];
    };
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    };
}

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
}
