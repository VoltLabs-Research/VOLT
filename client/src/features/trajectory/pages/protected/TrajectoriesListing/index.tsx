import { useCallback, useMemo, useState } from 'react'
import { usePageTitle } from '@/hooks/core/use-page-title'
import { formatSize } from '@/features/canvas/utilities/scene-utils'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, formatNumber, StatusBadge } from '@/components/organisms/common/DocumentListing'
import { useTrajectoryStore } from '@/features/trajectory/stores'
import { useTeamStore } from '@/features/team/stores'
import { formatDistance, formatDistanceToNow } from 'date-fns'
import { useUIStore } from '@/stores/slices/ui';
import { useNavigate } from 'react-router'
import useListingLifecycle from '@/hooks/common/use-listing-lifecycle'
import useConfirm from '@/hooks/ui/use-confirm'

const TrajectoriesListing = () => {
    usePageTitle('Trajectories')
    const getTrajectories = useTrajectoryStore((s) => s.getTrajectories)
    const deleteTrajectoryById = useTrajectoryStore((s) => s.deleteTrajectoryById)
    const team = useTeamStore((s) => s.selectedTeam)
    const isLoading = useTrajectoryStore((s) => s.isLoading)
    const isFetchingMore = useTrajectoryStore((s) => s.isFetchingMore)
    const trajectories = useTrajectoryStore((s) => s.trajectories)
    const listingMeta = useTrajectoryStore((s) => s.listingMeta)
    const navigate = useNavigate();

    const searchQuery = useUIStore((s) => s.query);
    const { confirm } = useConfirm();

    // We now pass these directly to DocumentListing
    const lifecycleProps = {
        listingMeta,
        fetchData: (params: any) => {
            if (!team?._id) return;
            return getTrajectories(team._id, { ...params, search: searchQuery });
        },
        initialFetchParams: { page: 1, limit: 20, search: searchQuery },
        dependencies: [team?._id, searchQuery, getTrajectories]
    };

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            if (await confirm(`Delete trajectory "${item.name}"? This action cannot be undone.`)) {
                await deleteTrajectoryById(item._id)
            }
        }
    }, [deleteTrajectoryById, confirm]);

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
            render: (_, row) => formatNumber(row?.frames?.[0]?.natoms ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Frames',
            key: 'frames',
            render: (_, row) => formatNumber(row?.frames?.length ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Total Size',
            key: 'stats.totalSize',
            render: (_, row) => formatSize(row?.stats?.totalSize ?? 0),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (v) => formatDistanceToNow(v, { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        },
        {
            title: 'Updated At',
            key: 'updatedAt',
            render: (v) => formatDistanceToNow(v, { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        }
    ], [])

    return (
        <DocumentListing
            title='Trajectories'
            columns={columns}
            data={trajectories}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
            {...lifecycleProps}
        />
    )
}

export default TrajectoriesListing
