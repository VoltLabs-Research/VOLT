export interface RowAggregation {
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
}

/**
 * Adds one row to its bucket: the fixed identity columns come first, the row's
 * own fields are merged in without overwriting them, and every field that is not
 * a fixed column is remembered so the header can list it.
 */
export const collectExportRow = (
    aggregation: RowAggregation,
    identityColumns: Record<string, unknown>,
    row: Record<string, unknown>,
    fixedColumns: string[]
): void => {
    const exportRow = { ...identityColumns };

    for (const [key, value] of Object.entries(row)) {
        if (!(key in exportRow)) {
            exportRow[key] = value;
            if (!fixedColumns.includes(key)) {
                aggregation.dynamicColumns.add(key);
            }
        }
    }

    aggregation.rows.push(exportRow);
};

export const buildExportColumns = (fixedColumns: string[], dynamicColumns: Set<string>): string[] => {
    return [
        ...fixedColumns,
        ...Array.from(dynamicColumns).sort((left, right) => left.localeCompare(right))
    ];
};
