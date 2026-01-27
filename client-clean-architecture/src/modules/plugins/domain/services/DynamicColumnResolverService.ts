import { CellValueFormatterService } from './CellValueFormatterService';

/**
 * Column definition for data tables.
 */
export interface ColumnDef {
    path: string;
    label: string;
    _meta?: {
        basePath: string;
        key: string;
        remainingPath: string;
    };
}

/**
 * Result of column resolution.
 */
export interface ColumnResolutionResult {
    columns: ColumnDef[];
    rows: any[];
}

/**
 * Service for resolving dynamic columns in plugin data tables.
 * Handles wildcard expansion and value resolution.
 */
export class DynamicColumnResolverService {
    private formatter = new CellValueFormatterService();

    /**
     * Resolves dynamic columns with wildcard expansion.
     *
     * @param rows - Data rows
     * @param columns - Column definitions (may contain wildcards)
     * @param getValueByPath - Function to get value from object by path
     * @returns Resolved columns and normalized rows
     */
    resolveDynamicColumns(
        rows: any[],
        columns: ColumnDef[],
        getValueByPath: (obj: any, path: string) => any
    ): ColumnResolutionResult {
        const expandedColumns: ColumnDef[] = [];
        const expandedKeys = new Set<string>();

        // Pass 1: Expand columns
        for (const col of columns) {
            if (col.path.includes('*')) {
                this.expandWildcardColumn(
                    col,
                    rows,
                    expandedColumns,
                    expandedKeys,
                    getValueByPath
                );
            } else {
                expandedColumns.push(col);
            }
        }

        // Pass 2: Resolve values
        const normalizedRows = this.normalizeRowsWithColumns(
            rows,
            expandedColumns,
            getValueByPath
        );

        return { columns: expandedColumns, rows: normalizedRows };
    }

    /**
     * Expands a wildcard column based on data.
     */
    private expandWildcardColumn(
        col: ColumnDef,
        rows: any[],
        expandedColumns: ColumnDef[],
        expandedKeys: Set<string>,
        getValueByPath: (obj: any, path: string) => any
    ): void {
        const match = col.path.match(/^\{\{\s*([^\.]+)\.(.+)\s*\}\}$/);
        if (!match) return;

        const [, , propPath] = match;
        const parts = propPath.split('*');
        const basePath = parts[0].replace(/\.$/, '');
        const remainingPath = parts[1] ? parts[1].replace(/^\./, '') : '';

        for (const row of rows) {
            const baseValue = getValueByPath(row, basePath) ||
                getValueByPath(row, basePath.split('.').pop()!);

            if (baseValue && typeof baseValue === 'object') {
                for (const key of Object.keys(baseValue)) {
                    const label = col.label === 'auto' ? key : `${col.label} ${key}`;
                    const fullPath = `${col.path}::${key}`;

                    if (!expandedKeys.has(fullPath)) {
                        expandedKeys.add(fullPath);
                        expandedColumns.push({
                            label,
                            path: fullPath,
                            _meta: { basePath, key, remainingPath }
                        });
                    }
                }
            }
        }
    }

    /**
     * Normalizes rows with resolved column values.
     */
    private normalizeRowsWithColumns(
        rows: any[],
        columns: ColumnDef[],
        getValueByPath: (obj: any, path: string) => any
    ): any[] {
        return rows.map(row => {
            const enriched = { ...row };

            for (const col of columns) {
                let val;

                if (col._meta) {
                    const { basePath, key, remainingPath } = col._meta;
                    const baseValue = getValueByPath(row, basePath) ||
                        getValueByPath(row, basePath.split('.').pop()!);

                    if (baseValue && baseValue[key]) {
                        val = remainingPath
                            ? getValueByPath(baseValue[key], remainingPath)
                            : baseValue[key];
                    }
                } else {
                    val = getValueByPath(row, col.path);
                }

                enriched[col.label] = this.formatter.formatCellValue(val, col.path);
            }

            if (!enriched._id) {
                enriched._id = row.timestep ?? row._objectKey ?? this.generateRowId();
            }

            return enriched;
        });
    }

    /**
     * Normalizes rows with simple column definitions.
     */
    normalizeRows(
        rows: any[],
        columns: ColumnDef[],
        getValueByPath: (obj: any, path: string) => any
    ): any[] {
        return rows.map(row => {
            const enriched = { ...row };

            for (const col of columns) {
                const { path, label } = col;
                let resolved = getValueByPath(row, path);

                if (resolved === undefined && label) {
                    resolved = getValueByPath(row, label);
                }

                enriched[path] = this.formatter.formatCellValue(resolved, path);
            }

            if (!enriched._id) {
                enriched._id = row.timestep ?? row._objectKey ?? this.generateRowId();
            }

            return enriched;
        });
    }

    /**
     * Generates a unique row ID.
     */
    private generateRowId(): string {
        return `row-${Math.random().toString(36).slice(2)}`;
    }
}
