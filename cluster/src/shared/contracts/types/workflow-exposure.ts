import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}

/**
 * Key under which an export payload carries the parquet it was derived from instead
 * of the entities themselves.
 *
 * A plugin may report an exposure as one JSON document in a single `payload` column.
 * Nothing bounds that document: a defect mesh over a multi-million-atom frame holds
 * tens of millions of vertices and facets, and the same entities are repeated under
 * `sub_listings`. Such a value cannot cross into JS at all — past 0x1fffffe8 (~512 MB)
 * characters V8 refuses to build the string and the read dies with
 * "Cannot create a string longer than 0x1fffffe8 characters".
 *
 * So the document is taken apart inside DuckDB and each unbounded section is written
 * to its own parquet. The exporter receives this key and streams columns out of that
 * file, which makes its cost proportional to the geometry it emits rather than to the
 * JSON that described it.
 */
export const PARQUET_SOURCE_KEY = '__parquet_source__';

/** The two tables a mesh is split into: one row per vertex, one row per facet. */
export interface MeshParquetSource {
    /** Columns: `slot` (document order), `vertex_id` (the vertex's own index), `x`, `y`, `z`. */
    vertices: string;
    /** Columns: `ord` (document order), `a`, `b`, `c` (vertex ids). */
    facets: string;
}

/**
 * A sub-listing handed over as bounded batches rather than one array.
 *
 * `rowCount` is the true total, so a caller that bounds what it persists can say what
 * it left out.
 */
export interface SubListingBatchSource {
    name: string;
    rowCount: number;
    readBatches: () => AsyncIterable<JsonObject[]>;
}
