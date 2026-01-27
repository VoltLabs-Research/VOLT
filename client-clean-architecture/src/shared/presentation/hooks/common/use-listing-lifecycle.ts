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
    data: T[];
    isLoading: boolean;
    isFetchingMore: boolean;
    listingMeta: ListingMeta;
    fetchData: (params: any) => Promise<void> | void;
    initialFetchParams?: Record<string, any>;
    dependencies?: any[];
    skipInitialFetch?: boolean;
}

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

    useEffect(() => {
        if (skipInitialFetch) return;

        const hasDependencies = dependencies.length > 0;
        const shouldFetch = data.length === 0 || hasDependencies;

        if (shouldFetch) {
            fetchData({
                ...initialFetchParams,
                force: hasDependencies && data.length > 0
            });
        }
    }, dependencies);

    const handleLoadMore = useCallback(async () => {
        if (!listingMeta.hasMore || isFetchingMore) return;

        const fetchParams = {
            ...initialFetchParams,
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            append: true,
            cursor: listingMeta.nextCursor
        };
        await fetchData(fetchParams);
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
