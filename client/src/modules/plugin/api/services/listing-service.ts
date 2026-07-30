import { createService, download, get } from '@/app/core/http/utils/create-service';
import { mapRawListingResponse } from './listing-response';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
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

export interface PluginListingMeta extends Record<string, unknown> {
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

interface ExposureSelectorParams {
    exposureId?: string;
    exposureName?: string;
}

const EMPTY_SELECTION_SENTINEL = '__volt_empty_selection__';

const requireExposureSelector = (params: ExposureSelectorParams, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const endpoints = {
    getListing: get<GetPluginListingInput, GetPluginListingResponse, RawListingResponse>('/plugins/:pluginId/listings', {
        unwrap: 'raw',
        omit: ['pluginId'],
        validate: (params) => requireExposureSelector(params, 'Exposure::IdRequired'),
        map: mapRawListingResponse
    }),
    getSubListing: get<GetSubListingInput, GetSubListingResponse>(
        '/plugins/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'
    ),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsInput, GetAnalysisListingExportOptionsResponse>(
        '/plugins/listings/analyses/:analysisId/export/options'
    ),
    exportListing: download<ExportPluginListingInput>('GET',
        '/plugins/:pluginId/listings/export',
        {
            query: ({ trajectoryId, analysisId, exposureId, exposureName, format }) => ({
                ...(trajectoryId ? { trajectoryId } : {}),
                ...(analysisId ? { analysisId } : {}),
                ...(exposureId ? { exposureId } : {}),
                ...(exposureName ? { exposureName } : {}),
                format
            }),
            validate: (params) => requireExposureSelector(params, 'Exposure::SelectorRequired')
        }
    ),
    exportListingByAnalysis: download<ExportListingByAnalysisInput>('GET',
        '/plugins/listings/analyses/:analysisId/export',
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
