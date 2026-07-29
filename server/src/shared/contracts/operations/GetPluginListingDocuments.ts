
import type { ExportType, PaginatedResult } from '@shared/domain/port/persistence';
import type { ListingRowData } from '@volt/contracts/modules/plugin/domain/listing';
export type { ListingRowData };

export interface GetPluginListingDocumentsInput {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
}

export interface ExportPluginListingDocumentsInput {
    pluginId: string;
    exposureId?: string;
    teamId: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    sortAsc?: boolean;
    format?: ExportType;
}

export interface ColumnDef {
    key?: string;
    label: string;
    title?: string;
    sortable: boolean;
    width?: number;
}

export interface PluginListingDocumentsMeta extends Record<string, unknown> {
    pluginId: string;
    exposureName: string;
    exposureId: string;
    columns: ColumnDef[];
    subListingNames: string[];
}

export interface GetPluginListingDocumentsOutput extends PaginatedResult<ListingRowData> {
    _meta: PluginListingDocumentsMeta;
}
