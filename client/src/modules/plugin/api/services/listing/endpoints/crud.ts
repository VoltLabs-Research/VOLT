import { get } from '@/app/core/http/utilities/create-service';
import type { PaginationMeta } from '@/shared/domain/pagination';
import type { ListingRow } from '../../../entities/listing-row';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../../../dtos/listing/get-plugin-listing';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '../../../dtos/listing/get-sub-listing';

interface RawListingResponse {
    status: string;
    data: {
        data: ListingRow[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
        _meta?: GetPluginListingOutputDTO['_meta'];
    };
    pagination?: PaginationMeta;
}

const requireExposureSelector = (params: { exposureId?: string; exposureName?: string }, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const endpoints = {
    getListing: get<GetPluginListingInputDTO, GetPluginListingOutputDTO>('/:pluginId/listings', {
        unwrap: 'raw',
        omit: ['pluginId'],
        validate: (params) => requireExposureSelector(params, 'Exposure::IdRequired'),
        map: (result) => {
            const raw = result as RawListingResponse;
            const inner = raw.data;
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
