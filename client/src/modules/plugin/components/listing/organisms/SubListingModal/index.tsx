import { useMemo, useCallback } from 'react';
import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/components/listing/organisms/PluginCompactTable';
import Modal from '@/shared/presentation/components/Modal';
import { SUB_LISTING_MODAL_ID } from '@/modules/plugin/hooks/listing/use-plugin-listing';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import type { PluginSubListingParams } from '@/modules/plugin/hooks/listing/use-plugin-sub-listing';

const SUB_LISTING_MODAL_PAGE_SIZE = 50;

interface SubListingModalProps {
    subListingParams: PluginSubListingParams | null;
    onClose?: () => void;
}

const SubListingModal: React.FC<SubListingModalProps> = ({ subListingParams, onClose }) => {

    const title = subListingParams
        ? formatSnakeCaseToTitle(subListingParams.subListingName)
        : 'Sub-Listing';

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage
    } = useSubListingInfiniteQuery(
        {
            analysisId: subListingParams?.analysisId ?? '',
            exposureId: subListingParams?.exposureId ?? '',
            timestep: subListingParams?.timestep ?? 0,
            subListingName: subListingParams?.subListingName ?? '',
            limit: SUB_LISTING_MODAL_PAGE_SIZE
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
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    return (
        <Modal
            id={SUB_LISTING_MODAL_ID}
            title={title}
            onClose={onClose}
            width='min(1100px, 92vw)'
        >
            <div style={{ height: '60vh' }}>
                <PluginCompactTable
                    columns={columns}
                    data={rows}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingNextPage}
                    hasMore={hasNextPage ?? false}
                    onLoadMore={handleLoadMore}
                />
            </div>
        </Modal>
    );
};

export default SubListingModal;
