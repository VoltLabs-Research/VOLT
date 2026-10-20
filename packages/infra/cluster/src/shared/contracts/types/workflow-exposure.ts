import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}

export const PARQUET_SOURCE_KEY = '__parquet_source__';

export interface MeshDomain {
    matrix: [
        [number, number, number],
        [number, number, number],
        [number, number, number]
    ];
    origin: [number, number, number];
    pbc: [boolean, boolean, boolean];
}

export interface MeshParquetSource {
    vertices: string;
    facets: string;
    cell?: MeshDomain;
}

export interface SubListingBatchSource {
    name: string;
    rowCount: number;
    readBatches: () => AsyncIterable<JsonObject[]>;
}
