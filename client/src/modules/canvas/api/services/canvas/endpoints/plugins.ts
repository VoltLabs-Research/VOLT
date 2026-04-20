import { get } from '@/app/core/http/utilities/create-service';
import type { PaginationMeta } from '@/shared/domain/pagination';
import type { Plugin } from '@/modules/plugin/api/entities/plugin';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO
} from '@/modules/plugin/api/dtos/listing/get-plugin-listing';
import type {
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '@/modules/plugin/api/dtos/listing/get-sub-listing';

interface PublicCanvasPluginInput {
    trajectoryId: string;
    pluginId: string;
};

interface PublicCanvasListingInput extends GetPluginListingInputDTO {
    trajectoryId: string;
};

interface PublicCanvasSubListingInput extends GetSubListingInputDTO {
    trajectoryId: string;
};

interface RawListingData {
    data: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: GetPluginListingOutputDTO['_meta'];
};

interface RawListingResponse {
    status: string;
    data: RawListingData;
    pagination?: PaginationMeta;
};

export default {
    getPlugin: get<PublicCanvasPluginInput, Plugin>('/:trajectoryId/plugins/:pluginId'),
    getPluginListing: get<PublicCanvasListingInput, GetPluginListingOutputDTO, RawListingResponse>(
        '/:trajectoryId/plugins/:pluginId/listings',
        {
            unwrap: 'raw',
            omit: ['trajectoryId', 'pluginId'],
            query: (params) => ({
                ...(params.exposureId ? { exposureId: params.exposureId } : {}),
                ...(params.exposureName ? { exposureName: params.exposureName } : {}),
                ...(params.analysisId ? { analysisId: params.analysisId } : {}),
                ...(params.page !== undefined ? { page: params.page } : {}),
                ...(params.limit !== undefined ? { limit: params.limit } : {})
            }),
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
        }
    ),
    getSubListing: get<PublicCanvasSubListingInput, GetSubListingOutputDTO>(
        '/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'
    )
};
