import { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { deduplicateById } from '@/shared/domain/utils/deduplicateById';
import usePaginationParams from './use-pagination-params';
import { ErrorSurface, isApiError, reportError } from '@/shared/errors/core';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useRef, useEffect, useMemo } from 'react';
import type { PaginationParams } from './use-pagination-params';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';

/**
 * Props for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationProps<T extends { _id: string }, TContext = Record<string, never>> {
    queryKey: QueryKey;
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    transformData?: (data: T[]) => T[];
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
};

/**
 * Return type for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationReturn<T extends { _id: string }> {
    data: T[];
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: string | null;
    errorCode: string | null;
    search: string;
    handleLoadMore: () => void;
    refresh: () => void;
};

/**
 * Hook to manage pagination logic for DocumentListing component.
 * Uses TanStack Query's useInfiniteQuery to manage server state.
 * URL search params are still used for search and limit via usePaginationParams.
 */
export function useDocumentListingPagination<T extends { _id: string }, TContext = Record<string, never>>(
    props: UseDocumentListingPaginationProps<T, TContext>
): UseDocumentListingPaginationReturn<T> {
    const {
        queryKey,
        fetchData,
        transformData,
        context,
        defaultLimit = 20,
        enabled = true
    } = props;

    const { limit, search } = usePaginationParams({ defaultLimit });

    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    });

    const effectiveQueryKey = useMemo(() => {
        const params: Record<string, unknown> = { limit };
        if (search.trim().length > 0) {
            params.search = search;
        }
        if (context) {
            Object.assign(params, context);
        }
        return [...queryKey, params];
    }, [queryKey, search, limit, context]);

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        error: queryError
    } = useInfiniteQuery<PaginatedResponse<T>, Error, InfiniteData<PaginatedResponse<T>, number>, QueryKey, number>({
        queryKey: effectiveQueryKey,
        queryFn: ({ pageParam }) => {
            const params = { page: pageParam, limit, search } as PaginationParams & TContext;
            if (search.trim().length === 0) {
                delete (params as Record<string, unknown>).search;
            }
            if (context) {
                Object.assign(params, context);
            }
            return fetchDataRef.current(params);
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) =>
            lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
        enabled,
        retry: (failureCount, error) => {
            if (isApiError(error) && error.status !== undefined && error.status < 500) {
                return false;
            }

            return failureCount < 3;
        }
    });

    // Derive flat data from pages, deduplicate, and optionally transform
    const data = useMemo(() => {
        if (!infiniteData?.pages) return [];
        const allItems = infiniteData.pages.flatMap((p) => p.data);
        const deduplicated = deduplicateById([], allItems);
        return transformData ? transformData(deduplicated) : deduplicated;
    }, [infiniteData, transformData]);

    // Extract error info
    const error = useMemo<string | null>(() => {
        if (!queryError) return null;
        return reportError(queryError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to fetch data'
        }).title;
    }, [queryError]);

    const errorCode = useMemo<string | null>(() => {
        if (!queryError) return null;
        return isApiError(queryError) ? queryError.code : null;
    }, [queryError]);

    const hasMore = hasNextPage ?? false;
    const isFetchingMore = isFetchingNextPage;

    const handleLoadMore = useCallback(() => {
        if (!isFetchingNextPage && hasNextPage) {
            fetchNextPage();
        }
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const refresh = useCallback(() => {
        queryClient.resetQueries({ queryKey: effectiveQueryKey });
    }, [effectiveQueryKey]);

    return {
        data,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        errorCode,
        search,
        handleLoadMore,
        refresh
    };
}

export default useDocumentListingPagination;
