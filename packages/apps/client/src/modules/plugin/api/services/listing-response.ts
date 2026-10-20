import type { PaginationMeta } from '@voltstack/voltclient';
import type { ListingRow } from '@volt/contracts/modules/plugin/listing';
import type { GetPluginListingResponse } from '@/modules/plugin/api/services/listing-service';

interface RawListingData {
    data: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: GetPluginListingResponse['_meta'];
}

export interface RawListingResponse {
    status: string;
    data: RawListingData;
    pagination?: PaginationMeta;
}

export const mapRawListingResponse = (result: RawListingResponse): GetPluginListingResponse => {
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
};
