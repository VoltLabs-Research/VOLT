import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSize } from '@/utilities/glb/scene-utils'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, formatNumber, StatusBadge } from '@/components/organisms/common/DocumentListing'
import { useTrajectoryStore } from '@/stores/slices/trajectory'
import { useTeamStore } from '@/stores/slices/team'
import formatTimeAgo from '@/utilities/api/formatTimeAgo'
import trajectoryApi from '@/services/api/trajectory/trajectory'
import { useUIStore } from '@/stores/slices/ui';
import { CiFileOn } from 'react-icons/ci'
import { useNavigate } from 'react-router'

const TrajectoriesListing = () => {
    const getTrajectories = useTrajectoryStore((s) => s.getTrajectories)
    const deleteTrajectoryById = useTrajectoryStore((s) => s.deleteTrajectoryById)
    const team = useTeamStore((s) => s.selectedTeam)
    const isLoading = useTrajectoryStore((s) => s.isLoading)
    const isFetchingMore = useTrajectoryStore((s) => s.isFetchingMore)
    const trajectories = useTrajectoryStore((s) => s.trajectories)
    const listingMeta = useTrajectoryStore((s) => s.listingMeta)
    const navigate = useNavigate();

    const searchQuery = useUIStore((s) => s.query);

    useEffect(() => {
        if (!team?._id) return;
        // Fetch handled by DashboardLayout prefetch, but ensure consistent state if missing
        if (trajectories.length === 0) {
            getTrajectories(team._id, { page: 1, limit: 20, search: searchQuery });
        } else if (searchQuery) {
            // If searching, we must fetch(store might cache non-search results)
            getTrajectories(team._id, { page: 1, limit: 20, search: searchQuery, force: true });
        }
    }, [team?._id, searchQuery, getTrajectories, trajectories.length])

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') {
            if (window.confirm('Delete this trajectory?')) {
                await deleteTrajectoryById(item._id)
            }
        }
    }, [deleteTrajectoryById]);

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
            title: 'Analysis',
            key: 'analysis',
            render: (arr) => formatNumber(arr?.length ?? 0),
            skeleton: { variant: 'text', width: 50 }
        },
        {
            title: 'Created At',
            key: 'createdAt',
            render: (v) => formatTimeAgo(v),
            skeleton: { variant: 'text', width: 90 }
        },
        {
            title: 'Updated At',
            key: 'updatedAt',
            render: (v) => formatTimeAgo(v),
            skeleton: { variant: 'text', width: 90 }
        }
    ], [])

    const handleLoadMore = useCallback(async () => {
        if (!team?._id || !listingMeta.hasMore || isFetchingMore) return;
        await getTrajectories(team._id, {
            page: listingMeta.page + 1,
            limit: listingMeta.limit,
            search: searchQuery,
            append: true
        });
    }, [team?._id, listingMeta, isFetchingMore, getTrajectories, searchQuery]);

    return (
        <DocumentListing
            title='Trajectories'
            columns={columns}
            data={trajectories}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
            enableInfinite
            hasMore={listingMeta.hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
        />
    )
}

export default TrajectoriesListing
