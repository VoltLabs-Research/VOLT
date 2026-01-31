import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiDeleteBin6Line, RiEyeLine, RiTableLine } from 'react-icons/ri';
import { formatDistanceToNow } from 'date-fns';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteTrajectory from '../../../hooks/trajectory/use-delete-trajectory';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { formatNumber, formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@/modules/trajectory/domain/entities';

const TrajectoriesListing = () => {
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoadingList);
    const isFetchingMore = useTrajectoryStore((state) => state.isFetchingMore);
    const listingMeta = useTrajectoryStore((state) => state.listingMeta);

    const getTrajectories = useGetTrajectories();
    const deleteTrajectory = useDeleteTrajectory();

    const fetchData = useCallback(async (params: { page?: number; limit?: number; append?: boolean; search?: string }) => {
        await getTrajectories(params);
    }, [getTrajectories]);

    const handleMenuAction = useCallback(async (action: string, item: unknown) => {
        const trajectory = item as Trajectory;
        if(action === 'delete'){
            if(await confirm(`Delete trajectory "${trajectory.name}"? This action cannot be undone.`)){
                await deleteTrajectory(trajectory._id);
            }
        }else if(action === 'viewAtoms'){
            const firstTimestep = trajectory?.frames?.[0]?.timestep ?? 0;
            navigate(`/dashboard/trajectory/${trajectory._id}/analysis/default/atoms/default?timestep=${firstTimestep}`);
        }else if(action === 'view'){
            navigate(`/dashboard/trajectory/${trajectory._id}`);
        }
    }, [deleteTrajectory, confirm, navigate]);

    const getMenuOptions = useCallback((item: unknown) => {
        const trajectory = item as Trajectory;
        return [
            ['View Scene', RiEyeLine, () => handleMenuAction('view', trajectory)],
            ['Inspect Atoms', RiTableLine, () => handleMenuAction('viewAtoms', trajectory)],
            ['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', trajectory)]
        ] as [string, React.ComponentType, () => void][];
    }, [handleMenuAction]);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'name',
            title: 'Name',
            render: (v) => String(v),
            skeleton: { variant: 'text', width: 120 }
        },
        {
            key: 'status',
            title: 'Status',
            render: (v) => <StatusBadge status={String(v || 'unknown')} />,
            skeleton: { variant: 'rounded', width: 70, height: 24 }
        },
        {
            key: 'frames',
            title: 'Atoms',
            render: (_, row) => {
                const trajectory = row as Trajectory;
                return formatNumber(trajectory?.frames?.[0]?.natoms ?? 0);
            },
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'frames',
            title: 'Frames',
            render: (_, row) => {
                const trajectory = row as Trajectory;
                return formatNumber(trajectory?.frames?.length ?? 0);
            },
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'stats.totalSize',
            title: 'Total Size',
            render: (_, row) => {
                const trajectory = row as Trajectory;
                return formatSize(trajectory?.stats?.totalSize ?? 0);
            },
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'createdAt',
            title: 'Created At',
            render: (v) => formatDistanceToNow(new Date(String(v)), { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        },
        {
            key: 'updatedAt',
            title: 'Updated At',
            render: (v) => formatDistanceToNow(new Date(String(v)), { addSuffix: true }),
            skeleton: { variant: 'text', width: 90 }
        }
    ], []);

    return (
        <DocumentListing
            title='Trajectories'
            columns={columns}
            data={trajectories}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
            fetchData={fetchData}
            listingMeta={listingMeta}
            initialFetchParams={{ page: 1, limit: 20 }}
            dependencies={[]}
        />
    );
};

export default TrajectoriesListing;
