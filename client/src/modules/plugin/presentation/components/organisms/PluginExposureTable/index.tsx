import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import PluginCompactTable from '@/modules/plugin/presentation/components/organisms/PluginCompactTable';
import SubListingModal from '@/modules/plugin/presentation/components/organisms/SubListingModal';
import useListingLifecycle, { type ListingMeta } from '@/shared/presentation/hooks/use-listing-lifecycle';
import usePluginListing from '@/modules/plugin/presentation/hooks/use-plugin-listing';
import ApiError from '@/shared/errors/ApiError';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import '@/modules/plugin/presentation/components/organisms/PluginExposureTable/PluginExposureTable.css';

export interface PluginExposureTableProps {
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    trajectoryId?: string;
    analysisId?: string;
    teamId?: string;
    compact?: boolean;
    showTrajectoryColumn?: boolean;
    headerActions?: ReactNode;
    onDataReady?: (columns: any[], data: any[]) => void;
}

const PluginExposureTable = ({
    pluginId,
    exposureName,
    exposureId,
    trajectoryId,
    analysisId,
    teamId,
    compact = false,
    showTrajectoryColumn,
    headerActions,
    onDataReady
}: PluginExposureTableProps) => {
    const listingHook = usePluginListing({
        pluginId,
        exposureName,
        exposureId,
        trajectoryId,
        analysisId,
        teamId,
        showTrajectoryColumn
    });
    const pageSize = compact ? 20 : 50;

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
    const [rbacDenied, setRbacDenied] = useState(false);
    const [rbacMessage, setRbacMessage] = useState<string>();

    const fetchBatch = useCallback(async (params: any) => {
        const { force, page } = params;
        const isInitial = page === 1;

        if (!pluginId || (!exposureName && !exposureId)) {
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

            setListingMeta(prev => ({
                ...prev,
                page,
                hasMore: Boolean(payload.pagination?.hasMore),
                nextCursor: null
            }));

            setRows((prev) => (isInitial && !params.append ? (payload.data ?? []) : [...prev, ...(payload.data ?? [])]));
        } catch (err: any) {
            if(ApiError.isRBACError(err)){
                setRbacDenied(true);
                if(err instanceof ApiError) setRbacMessage(err.getFriendlyMessage());
                return;
            }
            const message = err?.response?.data?.message || err?.message || 'Failed to load listing.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [exposureName, exposureId, pluginId, trajectoryId, teamId, pageSize, listingHook]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchBatch,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [pluginId, exposureName, exposureId, trajectoryId, teamId],
        skipInitialFetch: !compact,
        onReset: () => {
            setRows([]);
            setListingMeta(prev => ({ ...prev, page: 1, hasMore: false, nextCursor: null }));
        }
    });

    const displayRows = useMemo(() => rows, [rows]);

    useEffect(() => {
        if (!onDataReady || !compact) return;
        onDataReady(listingHook.columns, displayRows);
    }, [listingHook.columns, displayRows, onDataReady, compact]);

    if (rbacDenied) {
        return <AccessDenied description={rbacMessage} showBack={false} />;
    }

    if (compact) {
        return (
            <>
                <PluginCompactTable
                    columns={listingHook.columns}
                    data={displayRows}
                    hasMore={listingMeta.hasMore}
                    isLoading={loading}
                    isFetchingMore={isFetchingMore}
                    onLoadMore={handleLoadMore}
                    error={error}
                    onDataReady={onDataReady}
                />
                <SubListingModal />
            </>
        );
    }

    return (
        <>
            <DocumentListing
                title={exposureName || exposureId || 'Listing'}
                fetchData={listingHook.fetchData}
                context={listingHook.context}
                enabled={listingHook.isEnabled}
                columns={listingHook.columns}
                getMenuOptions={listingHook.getMenuOptions}
                exportConfig={{
                    onExport: ({ format }) => listingHook.exportData(format),
                    getFilename: (format) => `${pluginId}_${exposureName || exposureId || 'listing'}.${format}`
                }}
                headerActions={headerActions}
            />
            <SubListingModal />
        </>
    );
};

export default PluginExposureTable;
