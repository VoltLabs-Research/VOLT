import { useCallback, useMemo, useState } from 'react';
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import { useTeamStore } from '@/stores/slices/team';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { formatDistanceToNow } from 'date-fns';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import useListingLifecycle from '@/hooks/common/use-listing-lifecycle';
import useConfirm from '@/hooks/ui/use-confirm';

const AnalysisConfigsListing = () => {
    const team = useTeamStore((state) => state.selectedTeam);
    const analysisConfigs = useAnalysisConfigStore((state) => state.analysisConfigs);
    const getAnalysisConfigs = useAnalysisConfigStore((state) => state.getAnalysisConfigs);
    // Use store loading states
    const isListingLoading = useAnalysisConfigStore((state) => state.isListingLoading);
    const isFetchingMore = useAnalysisConfigStore((state) => state.isFetchingMore);
    const listingMeta = useAnalysisConfigStore((state) => state.listingMeta);
    const { confirm } = useConfirm();

    // We pass these directly to DocumentListing
    const lifecycleProps = {
        listingMeta,
        fetchData: (params: any) => {
            if (!team?._id) return;
            return getAnalysisConfigs(team._id, params);
        },
        initialFetchParams: { page: 1, limit: 20 },
        dependencies: [team?._id, getAnalysisConfigs]
    };

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        switch (action) {
            case 'view':
                break;

            case 'delete':
                const isConfirmed = await confirm('Delete this analysis config? This cannot be undone.');
                if (!isConfirmed) {
                    return;
                }

                try {
                    await analysisConfigApi.delete(item._id);
                    // Refresh current list(re-fetch page 1 or current set?)
                    // Safest is to reset to page 1
                    if (team?._id) getAnalysisConfigs(team._id, { page: 1, force: true });
                } catch (e) {
                    console.error('Failed to delete analysis config', e);
                }
                break;
        }
    }, [team?._id, getAnalysisConfigs, confirm]);

    const getMenuOptions = useCallback(
        (item: any) => ([
            ['View', RiEyeLine, () => handleMenuAction('view', item)],
            ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
        ]),
        [handleMenuAction]
    );

    const formatDate = useCallback((value: any) => {
        if (!value) return '-';
        const date = new Date(value);
        if (isNaN(date.getTime())) return '-';
        return formatDistanceToNow(date, { addSuffix: true });
    }, []);

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
            render: (value) => formatDate(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Finished At',
            sortable: true,
            key: 'finishedAt',
            render: (value) => formatDate(value),
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Created',
            sortable: true,
            key: 'createdAt',
            render: (value) => formatDate(value),
            skeleton: { variant: 'text', width: 100 }
        }
    ], [formatDate]);

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
            {...lifecycleProps}
        />
    );
};

export default AnalysisConfigsListing;
