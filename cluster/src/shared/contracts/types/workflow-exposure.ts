import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}

export const PARQUET_SOURCE_KEY = '__parquet_source__';

export interface MeshParquetSource {
    vertices: string;
    facets: string;
}

export interface SubListingBatchSource {
    name: string;
    rowCount: number;
    readBatches: () => AsyncIterable<JsonObject[]>;
}
