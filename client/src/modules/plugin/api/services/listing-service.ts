import { createService, download, get } from '@/app/core/http/utilities/create-service';

import type { PaginationMeta } from '@/shared/domain/pagination';
import type { ListingRow } from '../entities/listing/listing-row';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../dtos/listing/get-plugin-listing';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '../dtos/listing/get-sub-listing';
import type { ExportPluginListingInputDTO } from '../dtos/listing/export-plugin-listing';
import type { ExportListingByAnalysisInputDTO } from '../dtos/listing/export-listing-by-analysis';
import type { GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO } from '../dtos/listing/get-analysis-listing-export-options';

interface RawListingData {
    data: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: GetPluginListingOutputDTO['_meta'];
}

interface ExposureSelectorParams {
    exposureId?: string;
    exposureName?: string;
}

interface RawListingResponse {
    status: string;
    data: RawListingData;
    pagination?: PaginationMeta;
}

const EMPTY_SELECTION_SENTINEL = '__volt_empty_selection__';

const requireExposureSelector = (params: ExposureSelectorParams, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const buildExportListingPath = ({ pluginId, trajectoryId }: ExportPluginListingInputDTO) => {
    let path = `/${pluginId}/listings/export`;

    if (trajectoryId) {
        path = `/${pluginId}/listings/trajectories/${trajectoryId}/export`;
    }

    return path;
};

const endpoints = {
    getListing: get<GetPluginListingInputDTO, GetPluginListingOutputDTO, RawListingResponse>('/:pluginId/listings', {
        unwrap: 'raw',
        omit: ['pluginId'],
        validate: (params) => requireExposureSelector(params, 'Exposure::IdRequired'),
        map: (result) => {
            const inner = result.data;
            const pagination: PaginationMeta = {
                page: inner.page,
                limit: inner.limit,
                total: inner.total,
                totalPages: inner.totalPages,
                hasMore: inner.page < inner.totalPages
            };

            return {
                status: 'success',
                data: inner.data,
                pagination,
                ...(inner._meta ? { _meta: inner._meta } : {})
            };
        }
    }),
    getSubListing: get<GetSubListingInputDTO, GetSubListingOutputDTO>(
        '/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'
    ),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO>(
        '/listings/analyses/:analysisId/export/options'
    ),
    exportListing: download<ExportPluginListingInputDTO>('GET',
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
    exportListingByAnalysis: download<ExportListingByAnalysisInputDTO>('GET',
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
