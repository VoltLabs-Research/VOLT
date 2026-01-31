import { useEffect, useCallback } from 'react';
import type { ListingMeta } from '@/shared/domain/entities/ListingMeta';

interface FetchParams {
    page?: number;
    limit?: number;
    append?: boolean;
    cursor?: string | null;
    force?: boolean;
    [key: string]: unknown;
};

interface UseListingLifecycleOptions<T> {
    data: T[];
    isLoading: boolean;
    isFetchingMore: boolean;
    listingMeta: ListingMeta;
    fetchData: (params: FetchParams) => Promise<void> | void;
    initialFetchParams?: Record<string, unknown>;
    dependencies?: unknown[];
    skipInitialFetch?: boolean;
};

interface UseListingLifecycleResult {
    handleLoadMore: () => Promise<void>;
    isLoading: boolean;
    isFetchingMore: boolean;
    hasMore: boolean;
    total: number;
};

/**
 * Shared lifecycle hook for listing pages with infinite scroll.
 * Handles initial fetch and pagination logic.
 */
const useListingLifecycle = <T = unknown>({
    data,
    isLoading,
    isFetchingMore,
    listingMeta,
    fetchData,
    initialFetchParams = { page: 1, limit: 20 },
    dependencies = [],
    skipInitialFetch = false
}: UseListingLifecycleOptions<T>): UseListingLifecycleResult => {

    useEffect(() => {
        if(skipInitialFetch) return;

        const hasDependencies = dependencies.length > 0;
        const shouldFetch = data.length === 0 || hasDependencies;

        if(shouldFetch){
            fetchData({
                ...initialFetchParams,
                force: hasDependencies && data.length > 0
            });
        }
    }, dependencies);

    const handleLoadMore = useCallback(async () => {
        if(!listingMeta.hasMore || isFetchingMore) return;

        await fetchData({
            ...initialFetchParams,
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            append: true,
            cursor: listingMeta.nextCursor
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

export type { FetchParams, UseListingLifecycleOptions, UseListingLifecycleResult };
export default useListingLifecycle;
