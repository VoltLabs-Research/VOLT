import { useEffect, useState } from 'react'
import { RiDeleteBin6Line, RiEyeLine } from 'react-icons/ri'
import DocumentListing, { type ColumnConfig, formatNumber, StatusBadge } from '@/components/organisms/DocumentListing'
import useTrajectoryStore from '@/stores/trajectories'
import useTeamStore from '@/stores/team/team'
import formatTimeAgo from '@/utilities/formatTimeAgo'

const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(2).replace(/\.?0+$/, '')} ${units[i]}`
}

const TrajectoriesListing = () => {
    const getTrajectories = useTrajectoryStore((s) => s.getTrajectories)
    const deleteTrajectoryById = useTrajectoryStore((s) => s.deleteTrajectoryById)
    const team = useTeamStore((s) => s.selectedTeam)
    const isLoading = useTrajectoryStore((s) => s.isLoading)
    const trajectories = useTrajectoryStore((s) => s.trajectories)
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        if (team?._id) getTrajectories(team._id)
    }, [team])

    useEffect(() => {
        if (!isLoading) setData(trajectories || [])
    }, [isLoading, trajectories])

    const handleMenuAction = async (action: string, item: any) => {
        if (action === 'view') console.log('view', item)
        if (action === 'delete') await deleteTrajectoryById(item._id)
    }

    const getMenuOptions = (item: any) => [
        ['View', RiEyeLine, () => handleMenuAction('view', item)],
        ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]
    ]

    const columns: ColumnConfig[] = [
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
    ]

    return (
        <DocumentListing
            title='Trajectories'
            breadcrumbs={['Dashboard', 'Trajectories']}
            columns={columns}
            data={data}
            isLoading={isLoading}
            onMenuAction={handleMenuAction}
            getMenuOptions={getMenuOptions}
            showSearch
            emptyMessage='No trajectories found'
        />
    )
}

export default TrajectoriesListing
