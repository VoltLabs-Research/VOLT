import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatSize } from '@/utilities/scene-utils'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, formatNumber, StatusBadge } from '@/components/organisms/DocumentListing'
import useTrajectoryStore from '@/stores/trajectories'
import useTeamStore from '@/stores/team/team'
import formatTimeAgo from '@/utilities/formatTimeAgo'
import { api } from '@/api'
import useDashboardSearchStore from '@/stores/ui/dashboard-search'

const TrajectoriesListing = () => {
    const getTrajectories = useTrajectoryStore((s) => s.getTrajectories)
    const deleteTrajectoryById = useTrajectoryStore((s) => s.deleteTrajectoryById)
    const team = useTeamStore((s) => s.selectedTeam)
    const isLoading = useTrajectoryStore((s) => s.isLoading)
    const trajectories = useTrajectoryStore((s) => s.trajectories)
    const [data, setData] = useState<any[]>([])
    const [page, setPage] = useState<number>(1)
    const [total, setTotal] = useState<number>(0)
    const [limit] = useState<number>(50)

    const searchQuery = useDashboardSearchStore((s) => s.query);

    useEffect(() => {
        if (!team?._id) return;
        // Keep store fetch for cache/other UI only when not searching
        if(!searchQuery.trim()){
            getTrajectories(team._id);
        }
        let canceled = false;
        (async () => {
            try{
                const res = await api.get(`/trajectories`, {
                    params: { teamId: team._id, page: 1, limit, sort: '-createdAt', populate: 'analysis', q: searchQuery }
                });
                if(canceled) return;
                const payload: any = res.data;
                const rows = payload?.data || payload?.data?.data || [];
                const totalResults = payload?.results?.total ?? rows.length;
                setData(rows);
                setTotal(totalResults);
                setPage(1);
            }catch(_e){ /* noop */ }
        })();
        return () => { canceled = true; };
    }, [team?._id, limit, searchQuery])

    useEffect(() => {
        if (!isLoading && !searchQuery.trim()) setData(trajectories || [])
    }, [isLoading, trajectories, searchQuery])

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        if (action === 'delete') await deleteTrajectoryById(item._id)
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

    return (
        <DocumentListing
            title='Trajectories'
            breadcrumbs={['Dashboard', 'Trajectories']}
            columns={columns}
            data={data}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
            enableInfinite
            hasMore={data.length < total}
            isFetchingMore={isLoading && data.length > 0}
            onLoadMore={useCallback(async () => {
                if(!team?._id) return;
                if(data.length >= total) return;
                const next = page + 1;
                try{
                    const res = await api.get(`/trajectories`, {
                        params: { teamId: team._id, page: next, limit, sort: '-createdAt', populate: 'analysis', q: searchQuery }
                    });
                    const payload: any = res.data;
                    const rows = payload?.data || payload?.data?.data || [];
                    setData((prev) => [...prev, ...rows]);
                    setTotal(payload?.results?.total ?? total);
                    setPage(next);
                }catch(_e){ /* noop */ }
            }, [team?._id, data.length, total, page, limit, searchQuery])}
        />
    )
}

export default TrajectoriesListing
