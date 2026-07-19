import type { ExportType, PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface GetAnalysisListingExportOptionsInput {
    analysisId: string;
    teamId: string;
}

export interface AnalysisListingExportOptionView {
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOptionView {
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsOutput {
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOptionView[];
    subListings: AnalysisSubListingExportOptionView[];
}

export interface GetListingRowsByAnalysisIdInput {
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
