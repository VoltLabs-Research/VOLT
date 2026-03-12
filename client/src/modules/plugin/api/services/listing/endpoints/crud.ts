import { get } from '@/app/core/http/utilities/create-service';
import type { PaginationMeta } from '@/shared/domain/pagination';
import type { ListingRow } from '../../../entities/listing/listing-row';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../../../dtos/listing/get-plugin-listing';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '../../../dtos/listing/get-sub-listing';

interface RawListingData {
    data: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: GetPluginListingOutputDTO['_meta'];
};

interface ExposureSelectorParams {
    exposureId?: string;
    exposureName?: string;
};

interface RawListingResponse {
    status: string;
    data: RawListingData;
    pagination?: PaginationMeta;
};

const requireExposureSelector = (params: ExposureSelectorParams, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const endpoints = {
    getListing: get<GetPluginListingInputDTO, GetPluginListingOutputDTO, RawListingResponse>('/:pluginId/listings', {
        unwrap: 'raw',
        omit: ['pluginId', 'teamId'],
        query: ({
            analysisId,
            exposureId,
            exposureName,
            trajectoryId,
            page,
            limit
        }) => ({
            ...(analysisId ? { analysisId } : {}),
            ...(exposureId ? { exposureId } : {}),
            ...(exposureName ? { exposureName } : {}),
            ...(trajectoryId ? { trajectoryId } : {}),
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {})
        }),
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
    )
};

export default endpoints;
