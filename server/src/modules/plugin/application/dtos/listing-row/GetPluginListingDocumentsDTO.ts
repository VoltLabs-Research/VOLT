import { ExportType } from '@shared/domain/ports/IBaseRepository';

export interface GetPluginListingDocumentsInputDTO {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

export interface ExportPluginListingDocumentsInputDTO {
    pluginId: string;
    exposureId?: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    sortAsc?: boolean;
    format?: ExportType;
};

export interface ColumnDef {
    path: string;
    label: string;
};

export interface ListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
};

export interface GetPluginListingDocumentsOutputDTO {
    data: ListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: {
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnDef[];
    };
};

export interface ExportPluginListingDocumentsOutputDTO {
    meta: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
        columns: ColumnDef[];
        format: ExportType;
    };
    data: ListingRowData[];
};
