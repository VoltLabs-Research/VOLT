import { useEffect, useCallback } from 'react';

interface ListingMeta {
    page: number;
    limit: number;
    hasMore: boolean;
    total?: number;
    nextCursor?: string | null;
}

export type { ListingMeta };

interface UseListingLifecycleOptions<T> {
    /**
     * The data array from the store
     */
    data: T[];

    /**
     * Loading state for initial fetch
     */
    isLoading: boolean;

    /**
     * Loading state for pagination
     */
    isFetchingMore: boolean;

    /**
     * Pagination metadata
     */
    listingMeta: ListingMeta;

    /**
     * Function to fetch data
     */
    fetchData: (params: any) => Promise<void> | void;

    /**
     * Initial fetch parameters
     */
    initialFetchParams?: Record<string, any>;

    /**
     * Dependencies to trigger refetch (e.g., teamId, searchQuery)
     */
    dependencies?: any[];

    /**
     * Whether to skip initial fetch (if data is prefetched elsewhere)
     */
    skipInitialFetch?: boolean;
}

/**
 * Shared lifecycle hook for listing pages with infinite scroll.
 * Handles initial fetch and pagination logic.
 */
const useListingLifecycle = <T = any>({
    data,
    isLoading,
    isFetchingMore,
    listingMeta,
    fetchData,
    initialFetchParams = { page: 1, limit: 20 },
    dependencies = [],
    skipInitialFetch = false
}: UseListingLifecycleOptions<T>) => {

    // Initial fetch or refetch when dependencies change
    useEffect(() => {
        if (skipInitialFetch) return;

        // Check if we need to force refetch based on dependencies
        const hasDependencies = dependencies.length > 0;
        const shouldFetch = data.length === 0 || hasDependencies;

        if (shouldFetch) {
            fetchData({
                ...initialFetchParams,
                force: hasDependencies && data.length > 0
            });
        }
    }, dependencies);

    // Load more handler for infinite scroll
    const handleLoadMore = useCallback(async () => {
        if (!listingMeta.hasMore || isFetchingMore) return;

        await fetchData({
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            append: true,
            cursor: listingMeta.nextCursor,
            ...initialFetchParams
        });
    }, [listingMeta, isFetchingMore, fetchData, initialFetchParams]);

    return {
        handleLoadMore,
        isLoading,
        isFetchingMore,
        hasMore: listingMeta.hasMore,
        total: listingMeta.total
    };
};

export default useListingLifecycle;
