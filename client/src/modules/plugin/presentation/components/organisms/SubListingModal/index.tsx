import { useCallback, useEffect, useRef, useState } from 'react';
import usePluginListingStore from '@/modules/plugin/presentation/stores/use-plugin-listing-store';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-services';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import Modal from '@/shared/presentation/components/Modal';
import { SUB_LISTING_MODAL_ID } from '../../../hooks/use-plugin-listing';
import formatSnakeCaseToTitle from '@/modules/plugin/presentation/utilities/format-snake-case';

const SUB_LISTING_MODAL_PAGE_SIZE = 50;

const SubListingModal: React.FC = () => {
    const subListingParams = usePluginListingStore((s) => s.subListingParams);
    const { pluginListingRepository } = usePluginUseCases();

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const currentPageRef = useRef(1);

    const title = subListingParams
        ? formatSnakeCaseToTitle(subListingParams.subListingName)
        : 'Sub-Listing';

    const fetchPage = useCallback(async (page: number) => {
        if (!subListingParams) return;

        const isFirstPage = page === 1;

        if (isFirstPage) {
            setIsLoading(true);
            setRows([]);
            setColumns([]);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const response = await pluginListingRepository.getSubListing({
                analysisId: subListingParams.analysisId,
                exposureId: subListingParams.exposureId,
                timestep: subListingParams.timestep,
                subListingName: subListingParams.subListingName,
                page,
                limit: SUB_LISTING_MODAL_PAGE_SIZE
            });

            const mappedColumns: ColumnConfig[] = (response.columns || []).map((column) => ({
                key: column.label,
                title: formatSnakeCaseToTitle(column.label),
                sortable: column.sortable
            }));

            if (isFirstPage) {
                setColumns(mappedColumns);
                setRows(response.rows || []);
            } else {
                setRows((previousRows) => [...previousRows, ...(response.rows || [])]);
            }

            setHasMore(page < response.totalPages);
            currentPageRef.current = page;
        } catch {
            // Silently handle errors for modal context
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [subListingParams, pluginListingRepository]);

    useEffect(() => {
        if (!subListingParams) return;

        currentPageRef.current = 1;
        fetchPage(1);
    }, [subListingParams, fetchPage]);

    const handleLoadMore = useCallback(() => {
        fetchPage(currentPageRef.current + 1);
    }, [fetchPage]);

    return (
        <Modal
            id={SUB_LISTING_MODAL_ID}
            title={title}
            size="large"
        >
            <div style={{ height: '60vh' }}>
                <PluginCompactTable
                    columns={columns}
                    data={rows}
                    isLoading={isLoading}
                    isFetchingMore={isFetchingMore}
                    hasMore={hasMore}
                    onLoadMore={handleLoadMore}
                />
            </div>
        </Modal>
    );
};

export default SubListingModal;
