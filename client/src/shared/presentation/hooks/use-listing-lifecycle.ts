import { useEffect, useCallback, useRef, useMemo } from 'react';

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
    onReset?: () => void;
    onLoadMore?: (nextPage: number) => void;
    resetDependencies?: any[];
}

const useListingLifecycle = <T = any>({
    data,
    isLoading,
    isFetchingMore,
    listingMeta,
    fetchData,
    initialFetchParams = { page: 1, limit: 20 },
    dependencies = [],
    skipInitialFetch = false,
    onReset,
    onLoadMore,
    resetDependencies
}: UseListingLifecycleOptions<T>) => {
    // Use refs to avoid stale closures and prevent infinite loops
    const fetchDataRef = useRef(fetchData);
    const initialFetchParamsRef = useRef(initialFetchParams);
    const onResetRef = useRef(onReset);
    
    useEffect(() => {
        fetchDataRef.current = fetchData;
        initialFetchParamsRef.current = initialFetchParams;
        onResetRef.current = onReset;
    });

    // Serialize initialFetchParams for stable dependency
    const initialFetchParamsSignature = useMemo(
        () => JSON.stringify(initialFetchParams), 
        [initialFetchParams]
    );

    useEffect(() => {
        if (skipInitialFetch) return;

        const hasDependencies = dependencies.length > 0;
        const shouldFetch = data.length === 0 || hasDependencies;

        if (shouldFetch) {
            fetchDataRef.current({
                ...initialFetchParamsRef.current,
                force: hasDependencies && data.length > 0
            });
        }
    }, [skipInitialFetch, data.length, initialFetchParamsSignature, ...dependencies]);

    const resetDeps = resetDependencies ?? dependencies;
    const didResetRef = useRef(false);
    useEffect(() => {
        if (skipInitialFetch || !onResetRef.current) return;
        if (!resetDeps || resetDeps.length === 0) return;

        if (!didResetRef.current) {
            didResetRef.current = true;
            return;
        }

        onResetRef.current();
    }, [skipInitialFetch, ...(resetDeps ?? [])]);

    const handleLoadMore = useCallback(async () => {
        if (!listingMeta.hasMore || isFetchingMore) return;
        if (onLoadMore) {
            onLoadMore(listingMeta.page + 1);
            return;
        }
        const fetchParams = {
            ...initialFetchParamsRef.current,
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            append: true,
            cursor: listingMeta.nextCursor
        };
        await fetchDataRef.current(fetchParams);
    }, [listingMeta, isFetchingMore, onLoadMore]);

    return {
        handleLoadMore,
        isLoading,
        isFetchingMore,
        hasMore: listingMeta.hasMore,
        total: listingMeta.total
    };
};

export default useListingLifecycle;
