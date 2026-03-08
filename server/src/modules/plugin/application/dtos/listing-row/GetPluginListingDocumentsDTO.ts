import type { ExportType } from '@shared/domain/port/IBaseRepository';

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
    label: string;
    sortable: boolean;
    width?: number;
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

export interface PluginListingDocumentsMeta {
    pluginId: string;
    exposureName: string;
    exposureId: string;
    columns: ColumnDef[];
    subListingNames: string[];
};

export interface PluginListingExportMeta {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    total: number;
    columns: ColumnDef[];
    format: ExportType;
};

export interface GetPluginListingDocumentsOutputDTO {
    data: ListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: PluginListingDocumentsMeta;
};

export interface ExportPluginListingDocumentsOutputDTO {
    meta: PluginListingExportMeta;
    data: ListingRowData[];
};
