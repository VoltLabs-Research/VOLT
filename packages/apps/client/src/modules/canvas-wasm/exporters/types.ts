// Shapes of the cluster's export payloads and exporter options (export-node-processor-types.ts).

export type Vec3 = [number, number, number];
export type Rgba = [number, number, number, number];

export interface MeshDomain {
    matrix: [Vec3, Vec3, Vec3];
    origin: Vec3;
    pbc: [boolean, boolean, boolean];
}

export interface ExportMaterial {
    baseColor: Rgba;
    metallic: number;
    roughness: number;
    emissive: Vec3;
}

export interface Bounds {
    min: Vec3;
    max: Vec3;
}

export interface LineEntity {
    id: number;
    points: Vec3[];
    [property: string]: unknown;
}

export interface LineExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: Partial<ExportMaterial>;
    colorBy?: string;
    propertyColors?: Record<string, Rgba>;
}

export interface BondExportOptions extends Omit<LineExportOptions, 'lineWidth' | 'minSegmentPoints'> {
    radius?: number;
}

export interface MeshExportOptions {
    enableDoubleSided?: boolean;
    reverseOrientation?: boolean;
    interiorOnly?: boolean;
    smoothIterations?: number;
    material?: Partial<ExportMaterial>;
}

export interface AtomisticExportOptions {
    propertyColors?: Record<string, Rgba>;
}

export const PARQUET_SOURCE_KEY = '__parquet_source__';
