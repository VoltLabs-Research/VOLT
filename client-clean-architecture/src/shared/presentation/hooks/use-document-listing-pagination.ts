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
    fetchData: (
        params: PaginationParams & TContext
    ) => Promise<PaginatedResponse<T>>;

    onDataFetched: (
        result: PaginatedResponse<T>, 
        isFirstPage: boolean
    ) => void;

    onContextChange?: () => void;

    context?: TContext;
    defaultLimit?: number;
    enabled?: boolean;
};

/**
 * Return type for useDocumentListingPagination hook.
 */
export interface UseDocumentListingPaginationReturn {
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    error: string | null;
    handleLoadMore: () => void;
}

/**
 * Hook to manage pagination logic for DocumentListing component.
 * Handles URL params, fetching, loading states, and load more functionality.
 */
export function useDocumentListingPagination<T, TContext = Record<string, never>>(
    props: UseDocumentListingPaginationProps<T, TContext>
): UseDocumentListingPaginationReturn {
    const { 
        fetchData, 
        onDataFetched, 
        context, 
        onContextChange,
        defaultLimit = 20,
        enabled = true
    } = props;

    const { page, limit, search, updateParams } = usePaginationParams({ defaultLimit });
    
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track previous context to detect changes
    const prevContextRef = useRef<string | undefined>(undefined);

    // Detect context change and reset
    useEffect(() => {
        if(!context) return;
        
        const currentContext = JSON.stringify(context);
        const hasContextChanged = prevContextRef.current !== undefined && 
                                   prevContextRef.current !== currentContext;
        
        if(hasContextChanged){
            onContextChange?.();
            updateParams({ page: 1 });
        }
        
        prevContextRef.current = currentContext;
    }, [context, onContextChange, updateParams]);

    const fetchDataAsync = async () => {
        setIsLoading(true);
        setError(null);

        try{
            const params = { page, limit, search } as PaginationParams & TContext;
            
            // Merge context into params if provided
            if(context){
                Object.assign(params, context);
            }

            const result = await fetchData(params);
            
            const isFirstPage = page === 1;
            onDataFetched(result, isFirstPage);
            
            setHasMore(result.pagination.hasMore);
        }catch(err){
            const message = err instanceof Error ? err.message : 'Failed to fetch data';
            setError(message);
            console.error('[useDocumentListingPagination] Error fetching data:', err);
        }finally{
            setIsLoading(false);
        }
    };

    // Fetch data when pagination params or context changes
    useEffect(() => {
        if(!enabled) return;

        fetchDataAsync();
    }, [page, limit, search, context, enabled, fetchData, onDataFetched]);

    const handleLoadMore = useCallback(() => {
        if(!isLoading && hasMore) {
            updateParams({ page: page + 1 });
        }
    }, [isLoading, hasMore, page, updateParams]);

    const isFetchingMore = isLoading && page > 1;

    return {
        isLoading,
        isFetchingMore,
        hasMore,
        error,
        handleLoadMore
    };
}

export default useDocumentListingPagination;
