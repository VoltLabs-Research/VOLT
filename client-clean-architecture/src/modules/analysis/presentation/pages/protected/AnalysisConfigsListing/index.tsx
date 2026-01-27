import { useCallback, useMemo } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine, RiRefreshLine } from 'react-icons/ri';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { formatDistanceToNow } from 'date-fns';
import { useAnalysisConfigs, useDeleteAnalysisConfig, useRetryFailedFrames } from '@/modules/analysis/presentation/hooks/use-analysis-queries';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import { toast } from 'sonner';

const AnalysisConfigsListing = () => {
    usePageTitle('Analysis Configs');
    const team = useTeamStore((state) => state.selectedTeam);
    const teamId = team?._id ?? null;
    const {
        analysisConfigs,
        listingMeta,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useAnalysisConfigs({ teamId, limit: 20 });
    const deleteAnalysisConfig = useDeleteAnalysisConfig();
    const retryFailedFrames = useRetryFailedFrames();
    const { confirm } = useConfirm();

    const navigate = useNavigate();

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        switch (action) {
            case 'view':
                if (item?.trajectory?._id) {
                    navigate(`/canvas/${item.trajectory._id}`);
                }
                break;

            case 'delete':
                const isConfirmed = await confirm('Delete this analysis config? This cannot be undone.');
                if (!isConfirmed) {
                    return;
                }

                try {
                    await deleteAnalysisConfig.mutateAsync(item._id);
                    toast.success('Analysis config deleted successfully');
                    if (teamId) refetch();
                } catch (e) {
                    console.error('Failed to delete analysis config', e);
                    toast.error('Failed to delete analysis config');
                }
                break;

            case 'retry':
                try {
                    const response = await retryFailedFrames.mutateAsync(item._id);
                    if (!response) {
                        toast.error('Failed to retry frames');
                        break;
                    }
                    if (response.retriedFrames === 0) {
                        toast.info('No failed frames found to retry');
                    } else {
                        toast.success(
                            `Queued ${response.retriedFrames} failed frame${response.retriedFrames > 1 ? 's' : ''} for retry`
                        );
                    }
                } catch (e: any) {
                    console.error('Failed to retry frames', e);
                    toast.error(e?.response?.data?.message || 'Failed to retry frames');
                }
                break;
        }
    }, [teamId, deleteAnalysisConfig, retryFailedFrames, confirm, navigate, refetch]);

    const getMenuOptions = useCallback(
        (item: any) => ([
            ['View', RiEyeLine, () => handleMenuAction('view', item)],
            ['Retry Failed Frames', RiRefreshLine, () => handleMenuAction('retry', item)],
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
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage="No analysis configs found"
            listingMeta={listingMeta}
            hasMore={hasNextPage}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
        />
    );
};

export default AnalysisConfigsListing;
