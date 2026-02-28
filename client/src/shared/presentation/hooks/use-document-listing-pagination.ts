import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import usePaginationParams, { type PaginationParams } from './use-pagination-params';
import useListingLifecycle from './use-listing-lifecycle';
import useListSync, { type ListSyncConfig } from './use-list-sync';
import { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

/**
 * Props for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationProps<T, TContext = Record<string, never>> {
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    transformData?: (data: T[]) => T[];
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
    listSyncConfig?: ListSyncConfig;
};

/**
 * Return type for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationReturn<T> {
    data: T[];
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: string | null;
    search: string;
    handleLoadMore: () => void;
    refresh: () => void;
}

/**
 * Hook to manage pagination logic for DocumentListing component.
 * Handles URL params, fetching, data state, loading states, and load more functionality.
 */
export function useDocumentListingPagination<T, TContext = Record<string, never>>(
    props: UseDocumentListingPaginationProps<T, TContext>
): UseDocumentListingPaginationReturn<T> {
    const { 
        fetchData, 
        transformData,
        context, 
        defaultLimit = 20,
        enabled = true,
        listSyncConfig
    } = props;

    const { page, limit, search, updateParams } = usePaginationParams({ defaultLimit });
    
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    });

    const fetchDataAsync = useCallback(async (isRefresh = false) => {
        setIsLoading(true);
        setError(null);

        if(isRefresh){
            setData([]);
        }

        try{
            const params = { page, limit, search } as PaginationParams & TContext;
            
            if(context){
                Object.assign(params, context);
            }

            const result = await fetchDataRef.current(params);

            setData((prev) => {
                if(page === 1 || isRefresh || prev.length === 0){
                    return result.data;
                }
                return [...prev, ...result.data];
            });
            
            setHasMore(result.pagination.hasMore);
        }catch(err){
            if(err instanceof Error){
                setError(err.message);
            } else {
                setError('Failed to fetch data');
            }
            console.error('[useDocumentListingPagination] Error:', err);
        }finally{
            setIsLoading(false);
        }
    }, [page, limit, search, context]);

    // Fetch data when pagination params or context changes
    const contextSignature = useMemo(() => JSON.stringify(context ? context : {}), [context]);

    // Memoize callbacks to prevent infinite loops in useListingLifecycle
    const stableFetchData = useCallback(() => fetchDataAsync(), [fetchDataAsync]);
    const stableInitialFetchParams = useMemo(() => ({ page: 1, limit }), [limit]);
    const stableOnLoadMore = useCallback((nextPage: number) => updateParams({ page: nextPage }), [updateParams]);

    const resetToFirstPage = useCallback(() => {
        setData([]);
        if (page === 1) {
            fetchDataAsync(true);
        } else {
            updateParams({ page: 1 });
        }
    }, [page, fetchDataAsync, updateParams]);

    const { handleLoadMore } = useListingLifecycle({
        data,
        isLoading,
        isFetchingMore: isLoading && page > 1,
        listingMeta: {
            page,
            limit,
            hasMore
        },
        fetchData: stableFetchData,
        initialFetchParams: stableInitialFetchParams,
        dependencies: [page, limit, search, enabled],
        resetDependencies: [contextSignature],
        onLoadMore: stableOnLoadMore,
        skipInitialFetch: !enabled,
        onReset: resetToFirstPage
    });

    const refresh = useCallback(() => {
        if(!isLoading){
            resetToFirstPage();
        }
    }, [isLoading, resetToFirstPage]);

    const isFetchingMore = isLoading && page > 1;

    // Wire up real-time list sync via socket events
    useListSync<T & { _id: string }>({
        config: listSyncConfig,
        setData: setData as React.Dispatch<React.SetStateAction<(T & { _id: string })[]>>,
        refresh
    });

    const transformedData = transformData ? transformData(data) : data;

    return {
        data: transformedData,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        search,
        handleLoadMore,
        refresh
    };
}

export default useDocumentListingPagination;
