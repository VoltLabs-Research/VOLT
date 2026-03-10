import type { ColumnDef, ListingRowData } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';

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
};

export interface DaemonPaginatedResult {
    data: DaemonListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    columns?: string[];
    subListingNames?: string[];
};

export const SYSTEM_KEYS = new Set([
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

export const deriveColumns = (rows: DaemonListingRow[]): ColumnDef[] => {
    const seen = new Set<string>();

    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!SYSTEM_KEYS.has(key)) {
                seen.add(key);
            }
        }
    }

    return Array.from(seen).map((label) => ({
        label,
        sortable: true
    }));
};

export const mapDaemonRow = (row: DaemonListingRow): ListingRowData => {
    const rowFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
        if (!SYSTEM_KEYS.has(key)) {
            rowFields[key] = value;
        }
    }

    return {
        _id: row._id || '',
        timestep: row.timestep ?? 0,
        analysisId: String(row.analysis || ''),
        trajectoryId: String(row.trajectory || ''),
        exposureId: row.exposureId || '',
        trajectoryName: row.trajectoryName || '',
        ...rowFields
    };
};
