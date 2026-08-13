import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}

export const PARQUET_SOURCE_KEY = '__parquet_source__';

/**
 * The periodic domain a surface mesh is embedded in, as emitted by the analysis
 * plugin alongside the geometry. `matrix` holds the three cell vectors, `origin`
 * the cell's lower corner. Optional: a plugin that does not know its cell simply
 * omits it, and the exporter then skips the periodic rewrite.
 */
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
