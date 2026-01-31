import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiTableLine } from 'react-icons/ri';
import { formatDistanceToNow } from 'date-fns';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteTrajectory from '../../../hooks/trajectory/use-delete-trajectory';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { formatNumber, formatSize } from '@/shared/utils/format';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const TrajectoriesListing = () => {
    const navigate = useNavigate();
    
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);
    const appendTrajectories = useTrajectoryStore((state) => state.appendTrajectories);
    
    const getTrajectories = useGetTrajectories();
    const deleteTrajectory = useDeleteTrajectory();

    const handleDataFetched = useCallback((result: PaginatedResponse<Trajectory>, isFirstPage: boolean) => {
        if(isFirstPage) {
            setTrajectories(result.data);
        } else {
            appendTrajectories(result.data);
        }
    }, [setTrajectories, appendTrajectories]);

    const { getMenuOptions } = useListingActions<Trajectory>({
        actions: {
            view: {
                label: 'View Scene',
                handler: (trajectory) => navigate(`/dashboard/trajectory/${trajectory._id}`)
            },
            viewAtoms: {
                label: 'Inspect Atoms',
                icon: RiTableLine,
                handler: (trajectory) => {
                    const firstTimestep = trajectory.frames[0].timestep;
                    navigate(`/dashboard/trajectory/${trajectory._id}/analysis/default/atoms/default?timestep=${firstTimestep}`);
                }
            },
            delete: {
                handler: async (trajectory) => {
                    await deleteTrajectory(trajectory._id);
                },
                confirm: (trajectory) => `Delete trajectory "${trajectory.name}"? This action cannot be undone.`
            }
        }
    });

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
                return formatNumber(trajectory.frames[0].natoms);
            },
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'frames',
            title: 'Frames',
            render: (_, row) => formatNumber((row as Trajectory).frames.length),
            skeleton: { variant: 'text', width: 70 }
        },
        {
            key: 'stats.totalSize',
            title: 'Total Size',
            render: (_, row) => formatSize((row as Trajectory).stats.totalSize),
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
        <DocumentListing<Trajectory>
            title='Trajectories'
            columns={columns}
            data={trajectories}
            fetchData={getTrajectories}
            onDataFetched={handleDataFetched}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
        />
    );
};

export default TrajectoriesListing;
