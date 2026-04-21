import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import PluginCompactTable from '@/modules/plugin/components/listing/PluginCompactTable';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { useCallback, useMemo } from 'react';
import type { ColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';

interface PluginSubListingPanelProps {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
};

const SUB_LISTING_PAGE_SIZE = 50;

const PluginSubListingPanel = ({
    analysisId,
    exposureId,
    timestep,
    subListingName
}: PluginSubListingPanelProps) => {
    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = useSubListingInfiniteQuery(
        {
            analysisId,
            exposureId,
            timestep,
            subListingName,
            limit: SUB_LISTING_PAGE_SIZE
        },
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.page < lastPage.totalPages) {
                    return lastPage.page + 1;
                }
                return undefined;
            }
        }
    );

    const columns: ColumnConfig[] = useMemo(() => {
        if (!infiniteData?.pages?.length) return [];
        // Use the first page's columns definition
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
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const errorMessage = error ? 'Failed to load sub-listing data.' : null;

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            hasMore={hasNextPage ?? false}
            onLoadMore={handleLoadMore}
            error={errorMessage}
        />
    );
};

export default PluginSubListingPanel;
