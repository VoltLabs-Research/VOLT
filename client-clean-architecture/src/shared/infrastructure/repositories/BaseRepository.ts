import VoltClient, { VoltClientOptions } from '@/app/core/http/VoltClient';
import { http } from '@/app/di';
import { PaginatedResponse, PaginationMeta } from '@/shared/domain/pagination';

export interface ApiResponse<T>{
    status: string;
    data: T;
};

/**
 * Raw paginated response from server (before transformation)
 */
export interface RawPaginatedResponse<T>{
    status: 'success';
    data: {
        data: T[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
};

export default class BaseRepository{
    protected readonly client: VoltClient;

    constructor(
        basePath: string,
        opts: VoltClientOptions = {}
    ){
        this.client = new VoltClient(http, basePath, opts);
    }

    protected unwrap<T>(response: ApiResponse<T>): T{
        return response.data;
    }

    /**
     * Transforms the raw server paginated response to the client's PaginatedResponse format
     */
    protected unwrapPaginated<T>(raw: RawPaginatedResponse<T>): PaginatedResponse<T>{
        const { data: inner } = raw;

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
            pagination
        };
    }
};