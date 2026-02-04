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
    data: T[] | {
        data: T[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
    pagination?: PaginationMeta;
    _meta?: Record<string, unknown>;
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

    protected async getAllPaginated<T>(
        path: string,
        params?: Record<string, unknown>
    ): Promise<PaginatedResponse<T>>{
        const raw = await this.client.get<RawPaginatedResponse<T>>(path, params);
        return this.unwrapPaginated(raw);
    }

    /**
     * Transforms the raw server paginated response to the client's PaginatedResponse format
     */
    protected unwrapPaginated<T>(raw: RawPaginatedResponse<T>): PaginatedResponse<T>{
        if(Array.isArray(raw.data) && raw.pagination){
            return {
                status: 'success',
                data: raw.data,
                pagination: raw.pagination,
                _meta: raw._meta
            };
        }

        const inner = raw.data as {
            data: T[];
            total: number;
            page: number;
            totalPages: number;
            limit: number;
        };

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
