import { useSubListingInfiniteQuery } from './queries';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { useCallback, useMemo } from 'react';

import type { ColumnConfig } from '@/modules/plugin/components/listing/organisms/PluginCompactTable';
import type { PluginSubListingParams } from './use-plugin-sub-listing';

interface UsePluginSubListingDataResult {
    title: string;
    columns: ColumnConfig[];
    rows: Record<string, unknown>[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    error: unknown;
    handleLoadMore: () => void;
};

const SUB_LISTING_PAGE_SIZE = 50;

export const usePluginSubListingData = (
    subListingParams: PluginSubListingParams | null
): UsePluginSubListingDataResult => {
    const title = subListingParams
        ? formatSnakeCaseToTitle(subListingParams.subListingName)
        : 'Sub-Listing';

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = useSubListingInfiniteQuery(
        {
            analysisId: subListingParams?.analysisId ?? '',
            exposureId: subListingParams?.exposureId ?? '',
            timestep: subListingParams?.timestep ?? 0,
            subListingName: subListingParams?.subListingName ?? '',
            limit: SUB_LISTING_PAGE_SIZE
        },
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.page < lastPage.totalPages) {
                    return lastPage.page + 1;
                }

                return undefined;
            },
            enabled: Boolean(subListingParams)
        }
    );

    const columns: ColumnConfig[] = useMemo(() => {
        if (!infiniteData?.pages?.length) return [];

        const firstPage = infiniteData.pages[0];

        return (firstPage.columns || []).map((column) => ({
            key: column.label,
            title: formatSnakeCaseToTitle(column.label),
            sortable: column.sortable
        }));
    }, [infiniteData]);

    const rows: Record<string, unknown>[] = useMemo(() => {
        if (!infiniteData?.pages) return [];

        return infiniteData.pages.flatMap((page) => page.rows ?? []);
    }, [infiniteData]);

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    return {
        title,
        columns,
        rows,
        isLoading,
        isFetchingNextPage,
        hasNextPage: hasNextPage ?? false,
        error,
        handleLoadMore
    };
};
