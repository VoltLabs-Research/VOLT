export interface RowAggregation {
    rows: Record<string, unknown>[];
    dynamicColumns: Set<string>;
}

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
