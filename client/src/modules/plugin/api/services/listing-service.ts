import { createService, download, serviceRoutes } from '@/app/core/http/utils/create-service';
import { mapRawListingResponse } from './listing-response';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';
import type { RawListingResponse } from './listing-response';
import type { GetAnalysisListingExportOptionsResponse, SubListingColumn } from '@volt/contracts/modules/plugin/listing';

export type ExportType = 'json' | 'csv';

export interface ExportListingByAnalysisInput {
    analysisId: string;
    format: ExportType;
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
}

export interface ExportPluginListingInput {
    pluginId: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    format: ExportType;
}

export interface GetAnalysisListingExportOptionsInput {
    analysisId: string;
}

interface PluginListingMeta extends Record<string, unknown> {
    pluginId: string;
    exposureName: string;
    exposureId: string;
    columns: ColumnConfig[];
    subListingNames: string[];
}

export interface GetPluginListingInput {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
}

export interface GetPluginListingResponse extends PaginatedResponse<ListingRow> {
    _meta?: PluginListingMeta;
}

export interface GetSubListingInput {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    page?: number;
    limit?: number;
}

export interface GetSubListingResponse {
    subListingName: string;
    columns: SubListingColumn[];
    rows: Record<string, unknown>[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

const EMPTY_SELECTION_SENTINEL = '__volt_empty_selection__';

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    getListing: routes.route<GetPluginListingInput, GetPluginListingResponse, RawListingResponse>(pluginRoutes.getPluginListingDocuments, {
        unwrap: 'raw',
        omit: ['pluginId'],
        map: mapRawListingResponse
    }),
    getSubListing: routes.route<GetSubListingInput, GetSubListingResponse>(
        pluginRoutes.getSubListing
    ),
    getAnalysisListingExportOptions: routes.route<GetAnalysisListingExportOptionsInput, GetAnalysisListingExportOptionsResponse>(
        pluginRoutes.getAnalysisListingExportOptions
    ),
    exportListing: download<ExportPluginListingInput>('GET',
        routes.path(pluginRoutes.exportPluginListingDocuments),
        {
            query: ({ trajectoryId, analysisId, exposureId, exposureName, format }) => ({
                ...(trajectoryId ? { trajectoryId } : {}),
                ...(analysisId ? { analysisId } : {}),
                ...(exposureId ? { exposureId } : {}),
                ...(exposureName ? { exposureName } : {}),
                format
            })
        }
    ),
    exportListingByAnalysis: download<ExportListingByAnalysisInput>('GET',
        routes.path(pluginRoutes.exportListingRowsByAnalysisId),
        {
            query: ({ format, includeConfig, selectedListingIds, selectedSubListingIds }) => ({
                format,
                ...(includeConfig !== undefined ? { includeConfig } : {}),
                ...(selectedListingIds
                    ? {
                        selectedListingIds: selectedListingIds.length > 0
                            ? selectedListingIds.join(',')
                            : EMPTY_SELECTION_SENTINEL
                    }
                    : {}),
                ...(selectedSubListingIds
                    ? {
                        selectedSubListingIds: selectedSubListingIds.length > 0
                            ? selectedSubListingIds.join(',')
                            : EMPTY_SELECTION_SENTINEL
                    }
                    : {})
            })
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
