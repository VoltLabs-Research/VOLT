/**
 * Neutral, cross-module DTO contract for the get/export-plugin-listing-documents
 * use cases.
 *
 * Extracted from
 * `@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO`
 * during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginListingUseCase` consumes `GetPluginListingDocumentsOutputDTO`
 * (and the `IGetPluginListingDocumentsUseCase` port returns it). The output
 * transitively depends on `PluginListingDocumentsMeta` → `ColumnDef` and on
 * `ListingRowData`, so the whole shape group moves here together. The owner DTO
 * file re-exports every name so existing importers (the export use case, the
 * daemon-listing types, listing enrichment) compile unchanged. Pure types.
 */
import type { ExportType, PaginatedResult } from '@shared/domain/port/IBaseRepository';

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
}

export interface ExportPluginListingDocumentsInputDTO {
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

export interface ListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
}

export interface PluginListingDocumentsMeta extends Record<string, unknown> {
    pluginId: string;
    exposureName: string;
    exposureId: string;
    columns: ColumnDef[];
    subListingNames: string[];
}

export interface GetPluginListingDocumentsOutputDTO extends PaginatedResult<ListingRowData> {
    _meta: PluginListingDocumentsMeta;
}
