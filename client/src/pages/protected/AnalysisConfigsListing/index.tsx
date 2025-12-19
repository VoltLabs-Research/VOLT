import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import useTeamStore from '@/stores/team/team';
import analysisConfigApi from '@/services/api/analysis-config';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useDashboardSearchStore from '@/stores/ui/dashboard-search';

const AnalysisConfigsListing = () => {
    const team = useTeamStore((state) => state.selectedTeam);
    const analysisConfigs = useAnalysisConfigStore((state) => state.analysisConfigs);
    const getAnalysisConfigs = useAnalysisConfigStore((state) => state.getAnalysisConfigs);
    // Use store loading states
    const isListingLoading = useAnalysisConfigStore((state) => state.isListingLoading);
    const isFetchingMore = useAnalysisConfigStore((state) => state.isFetchingMore);
    const listingMeta = useAnalysisConfigStore((state) => state.listingMeta);

    const searchQuery = useDashboardSearchStore((s) => s.query);

    // Initial fetch handled by DashboardLayout or here if missing
    useEffect(() => {
        if (!team?._id) return;
        // Only fetch if empty to avoid double fetch with DashboardLayout, 
        // OR rely on DashboardLayout and just do nothing here?
        // To be safe against direct navigation, check if data exists.
        if (analysisConfigs.length === 0) {
            getAnalysisConfigs(team._id, { page: 1, limit: 20 });
        }
    }, [team?._id, getAnalysisConfigs, analysisConfigs.length]);

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        switch (action) {
            case 'view':
                break;

            case 'delete':
                if (!window.confirm('Delete this analysis config? This cannot be undone.')) {
                    return;
                }

                try {
                    await analysisConfigApi.delete(item._id);
                    // Refresh current list (re-fetch page 1 or current set?)
                    // Safest is to reset to page 1
                    if (team?._id) getAnalysisConfigs(team._id, { page: 1, force: true });
                } catch (e) {
                    console.error('Failed to delete analysis config', e);
                }
                break;
        }
    }, [team?._id, getAnalysisConfigs]);

    const getMenuOptions = useCallback(
        (item: any) => ([
            ['View', RiEyeLine, () => handleMenuAction('view', item)],
            ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
        ]),
        [handleMenuAction]
    );

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Trajectory',
            sortable: true,
            key: 'trajectory.name',
            render: (_value, row) => row?.trajectory?.name ?? '-',
            skeleton: { variant: 'text', width: 140 }
        },
        {
            title: 'Plugin',
            sortable: true,
            key: 'plugin',
            render: (value) => (value ? String(value) : '-'),
            skeleton: { variant: 'text', width: 110 }
        },
        {
            title: 'Total Frames',
            sortable: true,
            key: 'totalFrames',
            render: (value) =>
                typeof value === 'number' ? value.toLocaleString() : '-',
            skeleton: { variant: 'text', width: 90 }
        },
        {
            title: 'Started At',
            sortable: true,
            key: 'startedAt',
            render: (value) => formatTimeAgo(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Finished At',
            sortable: true,
            key: 'finishedAt',
            render: (value) => formatTimeAgo(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Created',
            sortable: true,
            key: 'createdAt',
            render: (value) => formatTimeAgo(value),
            skeleton: { variant: 'text', width: 100 }
        }
    ], []);

    const handleLoadMore = useCallback(async () => {
        if (!team?._id || !listingMeta.hasMore || isFetchingMore) return;
        await getAnalysisConfigs(team._id, {
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            append: true
        });
    }, [team?._id, listingMeta, isFetchingMore, getAnalysisConfigs]);

    return (
        <DocumentListing
            title="Analysis Configs"
            columns={columns}
            data={analysisConfigs}
            isLoading={isListingLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage="No analysis configs found"
            enableInfinite
            hasMore={listingMeta.hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
        />
    );
};

export default AnalysisConfigsListing;
