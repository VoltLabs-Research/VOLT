import { useCallback, useEffect, useRef, useState } from 'react';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import formatSnakeCaseToTitle from '@/modules/plugin/presentation/utils/format-snake-case';

interface PluginSubListingPanelProps {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
}

const SUB_LISTING_PAGE_SIZE = 50;

const PluginSubListingPanel = ({
    analysisId,
    exposureId,
    timestep,
    subListingName
}: PluginSubListingPanelProps) => {
    const { pluginListingRepository } = usePluginUseCases();
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentPageRef = useRef(1);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchPage = useCallback(async (
        page: number,
        signal: { cancelled: boolean }
    ) => {
        const isFirstPage = page === 1;

        if (isFirstPage) {
            setIsLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        setError(null);

        try {
            const response = await pluginListingRepository.getSubListing({
                analysisId,
                exposureId,
                timestep,
                subListingName,
                page,
                limit: SUB_LISTING_PAGE_SIZE
            });

            if (signal.cancelled) return;

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
            if (signal.cancelled) return;
            setError('Failed to load sub-listing data.');
        } finally {
            if (!signal.cancelled) {
                setIsLoading(false);
                setIsFetchingMore(false);
            }
        }
    }, [pluginListingRepository, analysisId, exposureId, timestep, subListingName]);

    useEffect(() => {
        const signal = { cancelled: false };
        currentPageRef.current = 1;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            fetchPage(1, signal);
        }, 200);

        return () => {
            signal.cancelled = true;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [fetchPage]);

    const handleLoadMore = useCallback(() => {
        const signal = { cancelled: false };
        fetchPage(currentPageRef.current + 1, signal);
    }, [fetchPage]);

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            error={error}
        />
    );
};

export default PluginSubListingPanel;
