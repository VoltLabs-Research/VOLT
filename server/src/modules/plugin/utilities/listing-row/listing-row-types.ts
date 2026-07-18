import type { ExportType, PaginatedResult } from '@shared/domain/port/IBaseRepository';

// ---- analysis listing export options ---------------------------------------

export interface GetAnalysisListingExportOptionsInputDTO {
    analysisId: string;
    teamId: string;
}

export interface AnalysisListingExportOptionDTO {
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOptionDTO {
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsOutputDTO {
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOptionDTO[];
    subListings: AnalysisSubListingExportOptionDTO[];
}

// ---- listing rows by analysis ----------------------------------------------

export interface GetListingRowsByAnalysisIdInputDTO {
    analysisId: string;
    teamId: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
}

export interface ListingRowByAnalysisData {
    _id: string;
    plugin: string;
    exposureId: string;
    exposureName: string;
    trajectory: string;
    trajectoryName: string;
    timestep: number;
    row: Record<string, unknown>;
}

export interface GetListingRowsByAnalysisIdOutputDTO extends PaginatedResult<ListingRowByAnalysisData> {}

export interface ExportListingRowsByAnalysisIdInputDTO {
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

export interface ExportListingRowsByAnalysisIdOutputDTO {
    analysisId: string;
    teamClusterId?: string;
    format: ExportType;
    config?: Record<string, unknown>;
    listings: AnalysisListingExportData[];
    subListings: AnalysisSubListingExportData[];
}

// ---- summarize analysis result ---------------------------------------------

export interface SummarizeAnalysisResultInputDTO {
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

export interface CategoricalColumnValue {
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

export interface SummarizeAnalysisResultOutputDTO {
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
