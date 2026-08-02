import type { ExportType, PaginatedResult } from '@shared/domain/port/persistence';
import type {
    GetAnalysisListingExportOptionsResponse,
    ListingRowByAnalysisData
} from '@volt/contracts/modules/plugin/listing';

export interface GetAnalysisListingExportOptionsInput {
    analysisId: string;
    teamId: string;
}

export type GetAnalysisListingExportOptionsOutput = GetAnalysisListingExportOptionsResponse;

export interface GetListingRowsByAnalysisIdInput {
    analysisId: string;
    teamId: string;
    page?: number;
    limit?: number;
}

export type GetListingRowsByAnalysisIdOutput = PaginatedResult<ListingRowByAnalysisData>;

export interface ExportListingRowsByAnalysisIdInput {
    analysisId: string;
    teamId: string;
    format?: ExportType;
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
}

export interface AnalysisListingExportData {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    columns: string[];
}

export interface AnalysisSubListingExportData {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    timestep: number;
    rows: Record<string, unknown>[];
    columns: string[];
}

export interface ExportListingRowsByAnalysisIdOutput {
    analysisId: string;
    teamClusterId?: string;
    config?: Record<string, unknown>;
    listings: AnalysisListingExportData[];
    subListings: AnalysisSubListingExportData[];
}

export interface SummarizeAnalysisResultInput {
    analysisId: string;
    teamId: string;
    exposureId?: string;
    maxRows?: number;
}

interface NumericColumnStats {
    kind: 'numeric';
    count: number;
    nullCount: number;
    min: number;
    max: number;
    mean: number;
    stddev: number;
}

interface CategoricalColumnValue {
    value: string;
    count: number;
}

interface CategoricalColumnStats {
    kind: 'categorical';
    count: number;
    nullCount: number;
    distinctCount: number;
    topValues: CategoricalColumnValue[];
}

export type ColumnStats = NumericColumnStats | CategoricalColumnStats;

export interface SummarizedColumn {
    name: string;
    stats: ColumnStats;
}

export interface SummarizedExposure {
    exposureId: string;
    exposureName: string;
    rowCount: number;
    columns: SummarizedColumn[];
}

export interface SummarizeAnalysisResultOutput {
    analysisId: string;
    pluginDisplayName: string;
    trajectoryName: string;
    status: string;
    hasResults: boolean;
    rowCount: number;
    sampledRows: number;
    truncated: boolean;
    exposures: SummarizedExposure[];
    note?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Listing pages are capped so a single request cannot pull a whole result set. */
export const resolveListingPagination = (
    { page, limit }: { page?: number; limit?: number }
): { page: number; limit: number } => {
    return {
        page: Math.max(DEFAULT_PAGE, Number(page) || DEFAULT_PAGE),
        limit: Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))
    };
};
