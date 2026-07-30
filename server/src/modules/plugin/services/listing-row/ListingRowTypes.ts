import type { ExportType, PaginatedResult } from '@shared/domain/port/persistence';
import type { ListingRowByAnalysisData } from '@volt/contracts/modules/plugin/listing';
export type { ListingRowByAnalysisData };

export interface GetAnalysisListingExportOptionsInput {
    analysisId: string;
    teamId: string;
}

import type {
    AnalysisListingExportOption,
    AnalysisSubListingExportOption
} from '@volt/contracts/modules/plugin/listing';

export type AnalysisListingExportOptionView = AnalysisListingExportOption;export interface GetAnalysisListingExportOptionsOutput {
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOptionView[];
    subListings: AnalysisSubListingExportOption[];
}

export interface GetListingRowsByAnalysisIdInput {
    analysisId: string;
    teamId: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
}

export interface GetListingRowsByAnalysisIdOutput extends PaginatedResult<ListingRowByAnalysisData> {}

export interface ExportListingRowsByAnalysisIdInput {
    analysisId: string;
    teamId: string;
    format?: ExportType;
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
    sortAsc?: boolean;
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
    format: ExportType;
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

export interface NumericColumnStats {
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

export interface CategoricalColumnStats {
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

interface ListingPaginationInput {
    page?: number;
    limit?: number;
}

interface ListingPagination {
    page: number;
    limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const resolveListingPagination = ({
    page,
    limit
}: ListingPaginationInput): ListingPagination => {
    return {
        page: Math.max(DEFAULT_PAGE, Number(page) || DEFAULT_PAGE),
        limit: Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT))
    };
};

export type AnalysisSubListingExportOptionView = AnalysisSubListingExportOption;
