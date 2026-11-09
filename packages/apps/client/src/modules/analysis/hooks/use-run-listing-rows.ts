import listingService from '@/modules/plugin/api/services/listing-service';
import { buildKeys } from '@/shared/query/query-keys';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { ListingRowByAnalysisData } from '@volt/contracts/modules/plugin/listing';

const KEYS = buildKeys<{ latest: string; all: string }>(['analysis', 'listing-rows']);

// The server's largest page; rows come newest timestep first.
const PAGE_LIMIT = 200;
// A run's rows are one per listing exposure and timestep; the report stops paging past this.
const MAX_PAGES = 15;

export const RUN_LISTING_ROWS_KEYS = KEYS;

/* The newest rows of a run, enough for the list's headline value and its recent trend. */
export const useRunLatestRows = (analysisId: string, enabled: boolean) => useQuery({
    queryKey: KEYS.latest(analysisId),
    queryFn: () => listingService.getListingRowsByAnalysis({ analysisId, page: 1, limit: PAGE_LIMIT }),
    enabled,
    staleTime: 60_000
});

interface RunAllRows {
    rows: ListingRowByAnalysisData[];
    isLoading: boolean;
    truncated: boolean;
    error: Error | null;
}

/* Every row of a run, paged in the background; the report draws from them once they are all in. */
export const useRunAllRows = (analysisId: string | undefined): RunAllRows => {
    const query = useInfiniteQuery({
        queryKey: KEYS.all(analysisId ?? ''),
        queryFn: ({ pageParam }) => listingService.getListingRowsByAnalysis({
            analysisId: analysisId ?? '',
            page: pageParam,
            limit: PAGE_LIMIT
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (
            lastPage.pagination.hasMore && lastPage.pagination.page < MAX_PAGES ? lastPage.pagination.page + 1 : undefined
        ),
        enabled: Boolean(analysisId)
    });

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const rows = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);
    const lastPage = query.data?.pages.at(-1);

    return {
        rows,
        isLoading: query.isLoading || Boolean(hasNextPage) || isFetchingNextPage,
        truncated: Boolean(lastPage?.pagination.hasMore && !hasNextPage),
        error: query.error
    };
};
