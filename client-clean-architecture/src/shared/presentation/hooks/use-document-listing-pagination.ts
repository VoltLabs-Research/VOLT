import { useState, useEffect, useCallback, useRef } from 'react';
import usePaginationParams from './use-pagination-params';
import { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

/**
 * Pagination params that will be merged with context.
 */
export interface PaginationParams {
    page: number;
    limit: number;
    search?: string;
};

/**
 * Props for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationProps<T, TContext = Record<string, never>> {
    fetchData: (params: PaginationParams & TContext) => Promise<PaginatedResponse<T>>;
    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
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
        context, 
        defaultLimit = 20,
        enabled = true
    } = props;

    const { page, limit, search, updateParams } = usePaginationParams({ defaultLimit });
    
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDataRef = useRef(fetchData);
    const prevContextRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        fetchDataRef.current = fetchData;
    });

    // Detect context change and reset
    useEffect(() => {
        if(!context) return;
        
        const currentContext = JSON.stringify(context);
        const hasContextChanged = prevContextRef.current !== undefined && 
                                   prevContextRef.current !== currentContext;
        
        if(hasContextChanged){
            setData([]);
            updateParams({ page: 1 });
        }
        
        prevContextRef.current = currentContext;
    }, [context, updateParams]);

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
            const isFirstPage = page === 1;
            
            if(isFirstPage || isRefresh){
                setData(result.data);
            }else{
                setData((prev) => [...prev, ...result.data]);
            }
            
            setHasMore(result.pagination.hasMore);
        }catch(err){
            const message = err instanceof Error ? err.message : 'Failed to fetch data';
            setError(message);
            console.error('[useDocumentListingPagination] Error:', err);
        }finally{
            setIsLoading(false);
        }
    }, [page, limit, search, context]);

    // Fetch data when pagination params or context changes
    useEffect(() => {
        if(!enabled) return;
        fetchDataAsync();
    }, [enabled, fetchDataAsync]);

    const handleLoadMore = useCallback(() => {
        if(!isLoading && hasMore){
            updateParams({ page: page + 1 });
        }
    }, [isLoading, hasMore, page, updateParams]);

    const refresh = useCallback(() => {
        if(!isLoading){
            if(page === 1){
                fetchDataAsync(true);
            }else{
                setData([]);
                updateParams({ page: 1 });
            }
        }
    }, [isLoading, page, fetchDataAsync, updateParams]);

    const isFetchingMore = isLoading && page > 1;

    return {
        data,
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        handleLoadMore,
        refresh
    };
}

export default useDocumentListingPagination;
