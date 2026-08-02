import queryClient from './query-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { InfiniteData, QueryKey, UseInfiniteQueryOptions } from '@tanstack/react-query';

export interface PaginationRequest {
    page: number;
    limit: number;
};

export type InfiniteQueryOptions<TData> = Omit<
    UseInfiniteQueryOptions<TData, Error, InfiniteData<TData, number>, QueryKey, number>,
    'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export type InfinitePages<TEntity> = InfiniteData<PaginatedResponse<TEntity>, number>;

const DEFAULT_PAGE_LIMIT = 20;

/**
 * Page cursors come from `pagination.hasMore`, which every paginated endpoint
 * returns, so no caller has to write the next-page arithmetic.
 */
export const createInfiniteQuery = <TParams, TEntity>(
    keyFn: (params: TParams) => QueryKey,
    fetchPage: (params: TParams, pagination: PaginationRequest) => Promise<PaginatedResponse<TEntity>>,
    config?: { defaultLimit?: number }
) => {
    const limit = config?.defaultLimit ?? DEFAULT_PAGE_LIMIT;

    return Object.assign(
        (params: TParams, options?: InfiniteQueryOptions<PaginatedResponse<TEntity>>) => useInfiniteQuery<
            PaginatedResponse<TEntity>,
            Error,
            InfinitePages<TEntity>,
            QueryKey,
            number
        >({
            ...options,
            queryKey: keyFn(params),
            queryFn: ({ pageParam }) => fetchPage(params, {
                page: pageParam,
                limit
            }),
            initialPageParam: 1,
            getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined
        }),
        {
            setData(
                params: TParams,
                updater: (current: InfinitePages<TEntity> | undefined) => InfinitePages<TEntity> | undefined
            ): void {
                queryClient.setQueryData<InfinitePages<TEntity>>(keyFn(params), updater);
            },
            invalidate(params: TParams): Promise<void> {
                return queryClient.invalidateQueries({ queryKey: keyFn(params) });
            },
            clear(params: TParams): void {
                queryClient.removeQueries({ queryKey: keyFn(params) });
            }
        }
    );
};
