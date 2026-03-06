import { ExportType } from '@shared/domain/port/IBaseRepository';

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
    row: any;
};

export interface GetListingRowsByAnalysisIdOutputDTO {
    data: ListingRowByAnalysisData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

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

export interface ExportListingRowsByAnalysisIdOutputDTO {
    analysisId: string;
    format: ExportType;
    listings: AnalysisListingExportData[];
};
