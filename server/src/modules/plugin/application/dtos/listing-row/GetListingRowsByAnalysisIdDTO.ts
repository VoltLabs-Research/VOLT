import type { ExportType, PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface GetListingRowsByAnalysisIdInputDTO {
    analysisId: string;
    teamId: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

export interface ListingRowByAnalysisData {
    _id: string;
    plugin: string;
    exposureId: string;
    exposureName: string;
    trajectory: string;
    trajectoryName: string;
    timestep: number;
    row: Record<string, unknown>;
};

export interface GetListingRowsByAnalysisIdOutputDTO extends PaginatedResult<ListingRowByAnalysisData> {};

export interface ExportListingRowsByAnalysisIdInputDTO {
    analysisId: string;
    teamId: string;
    format?: ExportType;
    sortAsc?: boolean;
};

export interface AnalysisListingExportData {
    listingId: string;
    listingName: string;
    rows: Record<string, unknown>[];
    columns: string[];
};

export interface AnalysisSubListingExportData {
    exposureId: string;
    exposureName: string;
    subListingName: string;
    timestep: number;
    rows: Record<string, unknown>[];
    columns: string[];
};

export interface ExportListingRowsByAnalysisIdOutputDTO {
    analysisId: string;
    format: ExportType;
    config?: Record<string, unknown>;
    listings: AnalysisListingExportData[];
    subListings: AnalysisSubListingExportData[];
};
