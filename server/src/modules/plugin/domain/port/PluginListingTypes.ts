import type { ExportType } from '@shared/domain/port/IBaseRepository';

export interface ListingOptions {
    teamId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    exposureId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
    format?: ExportType;
}

export interface ColumnConfig {
    label: string;
    sortable: boolean;
    width?: number;
}

export interface PluginListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
}

export interface PluginListingPaginatedResult {
    data: PluginListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: {
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnConfig[];
        subListingNames: string[];
    };
}

export interface PluginListingExportResult {
    meta: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
        columns: ColumnConfig[];
        format: ExportType;
    };
    data: PluginListingRowData[];
}
