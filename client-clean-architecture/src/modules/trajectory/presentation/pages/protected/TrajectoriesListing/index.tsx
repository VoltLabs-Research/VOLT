import { useCallback, useMemo } from 'react'
import { useTrajectories, useDeleteTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries'
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title'
// import { formatSize } from '@/modules/canvas/presentation/utilities/scene-utils' // TODO: Migrate or find alternative
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, formatNumber, StatusBadge } from '@/shared/presentation/components/organisms/common/DocumentListing'
import { useTeamStore } from '@/modules/team/presentation/stores'
import { formatDistanceToNow } from 'date-fns'
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import { useNavigate } from 'react-router'
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm'

const TrajectoriesListing = () => {
    usePageTitle('Trajectories')
    const team = useTeamStore((s) => s.selectedTeam)
    const searchQuery = useUIStore((s) => s.query);
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    const { 
        trajectories, 
        isLoading, 
        isFetchingNextPage, 
        hasNextPage, 
        fetchNextPage 
    } = useTrajectories({ search: searchQuery });

    const deleteMutation = useDeleteTrajectory();

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            if (await confirm(`Delete trajectory "${item.name}"? This action cannot be undone.`)) {
                await deleteMutation.mutateAsync(item._id)
            }
        } else if (action === 'view') {
            navigate(`/canvas/${item._id}/`);
        }
    }, [deleteMutation, confirm, navigate]);

    const getMenuOptions = useCallback((item: any) => ([
        ['View', RiEyeLine, () => handleMenuAction('view', item)],
        ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
    ]), [handleMenuAction]);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Name',
            key: 'name',
            render: (v) => String(v),
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Status',
            key: 'status',
            render: (v) => <StatusBadge status={v} />,
            skeleton: { variant: 'rounded', width: 70, height: 24 }
        },
        {
            title: 'Atoms',
            key: 'frames',
            render: (_, row: any) => formatNumber(row?.frames?.[0]?.natoms ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Frames',
            key: 'frames',
            render: (_, row: any) => formatNumber(row?.frames?.length ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Total Size',
            key: 'stats.totalSize',
            render: (_, row: any) => {
                // Simplified size formatting for now
                const bytes = row?.stats?.totalSize ?? 0;
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Analysis',
            key: 'analysis',
            render: (arr) => formatNumber(arr?.length ?? 0),
            skeleton: { variant: 'text', width: 50 }
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (v) => v ? formatDistanceToNow(new Date(v), { addSuffix: true }) : 'N/A',
            skeleton: { variant: 'text', width: 90 }
        },
        {
            title: 'Updated At',
            key: 'updatedAt',
            render: (v) => v ? formatDistanceToNow(new Date(v), { addSuffix: true }) : 'N/A',
            skeleton: { variant: 'text', width: 90 }
        }
    ], [])

    return (
        <DocumentListing
            title='Trajectories'
            columns={columns}
            data={trajectories}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            hasMore={hasNextPage}
            onLoadMore={fetchNextPage}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
        />
    )
}

export default TrajectoriesListing
