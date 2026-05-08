import type { PaginationMeta } from '@/shared/domain/pagination';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';
import type { GetPluginListingOutputDTO } from '@/modules/plugin/api/dtos/listing/get-plugin-listing';

export interface RawListingData {
    data: ListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: GetPluginListingOutputDTO['_meta'];
}

export interface RawListingResponse {
    status: string;
    data: RawListingData;
    pagination?: PaginationMeta;
}

export const mapRawListingResponse = (result: RawListingResponse): GetPluginListingOutputDTO => {
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
