import { createService, download, get } from '@/app/core/http/utilities/create-service';
import { mapRawListingResponse } from './listing-response';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { ListingRow } from '@/modules/plugin/api/types/listing/listing-row';
import type { RawListingResponse } from './listing-response';

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

export interface AnalysisListingExportOption {
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOption {
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsInput {
    analysisId: string;
}

export interface GetAnalysisListingExportOptionsResponse {
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOption[];
    subListings: AnalysisSubListingExportOption[];
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

export interface SubListingColumn {
    label: string;
    sortable: boolean;
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

const buildExportListingPath = ({ pluginId, trajectoryId }: ExportPluginListingInput) => {
    let path = `/${pluginId}/listings/export`;

    if (trajectoryId) {
        path = `/${pluginId}/listings/trajectories/${trajectoryId}/export`;
    }

    return path;
};

const endpoints = {
    getListing: get<GetPluginListingInput, GetPluginListingResponse, RawListingResponse>('/:pluginId/listings', {
        unwrap: 'raw',
        omit: ['pluginId'],
        validate: (params) => requireExposureSelector(params, 'Exposure::IdRequired'),
        map: mapRawListingResponse
    }),
    getSubListing: get<GetSubListingInput, GetSubListingResponse>(
        '/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'
    ),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsInput, GetAnalysisListingExportOptionsResponse>(
        '/listings/analyses/:analysisId/export/options'
    ),
    exportListing: download<ExportPluginListingInput>('GET',
        buildExportListingPath,
        {
            query: ({ analysisId, exposureId, exposureName, format }) => ({
                ...(analysisId ? { analysisId } : {}),
                ...(exposureId ? { exposureId } : {}),
                ...(exposureName ? { exposureName } : {}),
                format
            }),
            validate: (params) => requireExposureSelector(params, 'Exposure::SelectorRequired')
        }
    ),
    exportListingByAnalysis: download<ExportListingByAnalysisInput>('GET',
        '/listings/analyses/:analysisId/export',
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
            basePath: '/plugins',
            useRBAC: true
        }
    }
}, endpoints);
