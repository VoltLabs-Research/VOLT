import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import PluginCompactTable from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import useListingLifecycle, { type ListingMeta } from '@/shared/presentation/hooks/use-listing-lifecycle';
import usePluginListing from '@/modules/plugin/presentation/hooks/use-plugin-listing';
import '@/modules/plugin/presentation/components/organisms/PluginExposureTable/PluginExposureTable.css';

export interface PluginExposureTableProps {
    pluginSlug: string;
    listingSlug: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
    onDataReady?: (columns: any[], data: any[]) => void;
}

const PluginExposureTable = ({
    pluginSlug,
    listingSlug,
    trajectoryId,
    analysisId,
    teamId,
    compact = false,
    showTrajectoryColumn,
    headerActions,
    onDataReady
}: PluginExposureTableProps) => {
    const listingHook = usePluginListing({
        pluginSlug,
        listingSlug,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn
    });
    const pageSize = compact ? 20 : 50;

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1,
        limit: pageSize,
        hasMore: false,
        nextCursor: null
    });
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBatch = useCallback(async (params: any) => {
        const { force, page } = params;
        const isInitial = page === 1;

        if (!pluginSlug || !listingSlug) {
            setError('Invalid listing parameters.');
            return;
        }

        if (!trajectoryId && !teamId) {
            setError('Please select a team or trajectory first.');
            return;
        }

        setError(null);
        if (isInitial || force) {
            setLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const payload = await listingHook.fetchData({
                ...listingHook.context,
                page,
                limit: pageSize
            }) as any;

            const nextColumns = (payload?._meta?.columns as ColumnConfig[] | undefined) ?? listingHook.columns;
            setColumns(nextColumns);

            setListingMeta(prev => ({
                ...prev,
                page,
                hasMore: Boolean(payload.pagination?.hasMore),
                nextCursor: null
            }));

            setRows((prev) => (isInitial && !params.append ? (payload.data ?? []) : [...prev, ...(payload.data ?? [])]));
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [listingSlug, pluginSlug, trajectoryId, teamId, pageSize, listingHook]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchBatch,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [pluginSlug, listingSlug, trajectoryId, teamId],
        skipInitialFetch: !compact,
        onReset: () => {
            setRows([]);
            setColumns([]);
            setListingMeta(prev => ({ ...prev, page: 1, hasMore: false, nextCursor: null }));
        }
    });

    const displayRows = useMemo(() => rows, [rows]);

    useEffect(() => {
        if (!onDataReady || !compact) return;
        onDataReady(columns, displayRows);
    }, [columns, displayRows, onDataReady, compact]);

    if (compact) {
        return (
            <PluginCompactTable
                columns={columns}
                data={displayRows}
                hasMore={listingMeta.hasMore}
                isLoading={loading}
                isFetchingMore={isFetchingMore}
                onLoadMore={handleLoadMore}
                error={error}
                onDataReady={onDataReady}
            />
        );
    }

    return (
        <DocumentListing
            title={listingSlug}
            fetchData={listingHook.fetchData}
            context={listingHook.context}
            enabled={listingHook.isEnabled}
            columns={listingHook.columns}
            getMenuOptions={listingHook.getMenuOptions}
            headerActions={headerActions}
        />
    );
};

export default PluginExposureTable;
