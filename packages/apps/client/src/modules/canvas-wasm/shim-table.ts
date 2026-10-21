// The WASM DuckDB shim (coretoolkit/compat/wasm/duckdb.hpp) writes every ".parquet" output as JSON.
export interface ShimTable {
    columns: Array<{ name: string; type: string }>;
    rows: unknown[][];
}

export const parseShimTable = (raw: string): ShimTable | null => {
    try {
        const parsed = JSON.parse(raw) as Partial<ShimTable> | null;
        return Array.isArray(parsed?.columns) && Array.isArray(parsed?.rows) ? parsed as ShimTable : null;
    } catch {
        return null;
    }
};

// Summary exposures are a single `payload` row holding the JSON document (main_listing, sub_listings, ...).
export const readPayloadDocument = (table: ShimTable): Record<string, unknown> | null => {
    if (table.columns.length !== 1 || table.columns[0].name !== 'payload') {
        return null;
    }
    const payload = table.rows[0]?.[0];
    try {
        const document = typeof payload === 'string' ? JSON.parse(payload) as unknown : payload;
        return document && typeof document === 'object' && !Array.isArray(document)
            ? document as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
};
