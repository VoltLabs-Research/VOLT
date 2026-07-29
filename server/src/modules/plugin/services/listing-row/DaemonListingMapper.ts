import type { ColumnDef, ListingRowData } from '@shared/contracts/operations/GetPluginListingDocuments';

export interface DaemonListingRow {
    _id: string;
    plugin?: string;
    team?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
    trajectoryName?: string;
    timestep?: number;
    subListingNames?: string[];
    row?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface DaemonPaginatedResult {
    data: DaemonListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    columns?: string[];
    subListingNames?: string[];
}

const SYSTEM_KEYS = new Set([
    '_id',
    'plugin',
    'team',
    'trajectory',
    'analysis',
    'exposureId',
    'exposureName',
    'trajectoryName',
    'timestep',
    'subListingNames',
    '__v',
    'row'
]);

/**
 * Daemon rows come from Mongo, so `_id` arrives as an ObjectId that the reverse
 * channel has already turned into `{ buffer: { data: [...] } }`. The wire
 * contract declares a hex string, so the bytes are rebuilt here instead of
 * leaking a raw buffer to clients.
 */
export const toListingRowId = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    const bytes = (value as { buffer?: { data?: unknown } })?.buffer?.data;
    if (Array.isArray(bytes)) {
        return Buffer.from(bytes as number[]).toString('hex');
    }

    return '';
};

export const deriveColumns = (rows: DaemonListingRow[]): ColumnDef[] => {
    const seen = new Set<string>();

    for (const row of rows) {
        const nestedRow = row.row;
        if (nestedRow && typeof nestedRow === 'object' && !Array.isArray(nestedRow)) {
            for (const key of Object.keys(nestedRow)) {
                seen.add(key);
            }
        } else {
            for (const key of Object.keys(row)) {
                if (!SYSTEM_KEYS.has(key)) {
                    seen.add(key);
                }
            }
        }
    }

    return Array.from(seen).map((label) => ({
        key: label,
        label,
        sortable: true
    }));
};

export const mapDaemonRow = (row: DaemonListingRow): ListingRowData => {
    const nestedRow = row.row;
    const rowFields: Record<string, unknown> = {};

    if (nestedRow && typeof nestedRow === 'object' && !Array.isArray(nestedRow)) {
        for (const [key, value] of Object.entries(nestedRow)) {
            rowFields[key] = value;
        }
    } else {
        for (const [key, value] of Object.entries(row)) {
            if (!SYSTEM_KEYS.has(key)) {
                rowFields[key] = value;
            }
        }
    }

    return {
        _id: toListingRowId(row._id),
        timestep: row.timestep ?? 0,
        analysisId: String(row.analysis || ''),
        trajectoryId: String(row.trajectory || ''),
        exposureId: row.exposureId || '',
        trajectoryName: row.trajectoryName as string,
        ...rowFields
    };
};
