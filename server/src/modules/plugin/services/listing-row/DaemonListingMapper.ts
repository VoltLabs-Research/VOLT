import type { ColumnDef } from '@shared/contracts/operations/GetPluginListingDocuments';
import type { ListingRowByAnalysisData, ListingRowData } from '@volt/contracts/modules/plugin/listing';

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

export interface DaemonPaginatedResult<TRow = DaemonListingRow> {
    data: TRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    columns?: string[];
    subListingNames?: string[];
}

export interface DaemonSubListingRow {
    _id: string;
    row?: Record<string, unknown>;
    [key: string]: unknown;
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

export const toListingRowId = (value: unknown): string => (typeof value === 'string' ? value : '');

const readRowFields = (row: DaemonListingRow): Record<string, unknown> => {
    if (row.row) {
        return row.row;
    }

    return Object.fromEntries(
        Object.entries(row).filter(([key]) => !SYSTEM_KEYS.has(key))
    );
};

export const deriveColumns = (rows: DaemonListingRow[]): ColumnDef[] => {
    const seen = new Set<string>();

    for (const row of rows) {
        for (const key of Object.keys(readRowFields(row))) {
            seen.add(key);
        }
    }

    return Array.from(seen).map((label) => ({
        key: label,
        label,
        sortable: true
    }));
};

export const mapDaemonRow = (row: DaemonListingRow): ListingRowData => {
    return {
        _id: toListingRowId(row._id),
        timestep: row.timestep ?? 0,
        analysisId: row.analysis || '',
        trajectoryId: row.trajectory || '',
        exposureId: row.exposureId || '',
        trajectoryName: row.trajectoryName as string,
        ...readRowFields(row)
    };
};

export const mapDaemonRowByAnalysis = (row: DaemonListingRow): ListingRowByAnalysisData => {
    return {
        _id: toListingRowId(row._id),
        plugin: row.plugin || '',
        exposureId: row.exposureId || '',
        exposureName: row.exposureName || '',
        trajectory: row.trajectory || '',
        trajectoryName: row.trajectoryName as string,
        timestep: row.timestep ?? 0,
        row: row.row ?? {}
    };
};
