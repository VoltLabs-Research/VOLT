import { fetchTrajectories, trajectoryQuery, TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import { runAction } from '@/shared/presentation/actions/run-action';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { dateColumn, statusColumn } from '@/shared/presentation/utilities/column-presets';
import { createPromiseToastOptions, type PromiseToastOptions } from '@/shared/presentation/toast-options';
import { formatNumber, formatSize } from '@/shared/utils/format';
import { RiTableLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';

interface ColumnSkeletonText {
    variant: 'text';
    width: number;
};

const DELETE_TRAJECTORY_TOAST: PromiseToastOptions = createPromiseToastOptions({
    loading: 'Deleting trajectory...',
    success: 'Trajectory deleted',
    error: 'Failed to delete trajectory'
});

const NAME_SKELETON: ColumnSkeletonText = {
    variant: 'text',
    width: 120
};

const SMALL_TEXT_SKELETON: ColumnSkeletonText = {
    variant: 'text',
    width: 70
};

const getTrajectoryRow = (row: unknown): Trajectory | undefined => {
    if (!row || typeof row !== 'object') {
        return undefined;
    }

    return row as Trajectory;
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'trajectory.created', queryKeys: [TRAJECTORY_QUERY_KEYS.trajectoriesList({ page: 1, limit: 20 })] },
    { event: 'trajectory.deleted', queryKeys: [TRAJECTORY_QUERY_KEYS.trajectoriesList({ page: 1, limit: 20 })] },
    { event: 'trajectory.updated', queryKeys: [TRAJECTORY_QUERY_KEYS.trajectoriesList({ page: 1, limit: 20 })] }
];

const COLUMNS: ColumnConfig<Trajectory>[] = [
    {
        key: 'name',
        title: 'Name',
        render: String,
        skeleton: NAME_SKELETON
    },
    statusColumn<Trajectory>('status', 'Status', { width: 70 }),
    {
        key: 'atoms',
        title: 'Atoms',
        render: (_value, row) => formatNumber(getTrajectoryRow(row)?.frames[0]?.natoms ?? 0),
        skeleton: SMALL_TEXT_SKELETON
    },
    {
        key: 'framesCount',
        title: 'Frames',
        render: (_value, row) => formatNumber(getTrajectoryRow(row)?.frames.length ?? 0),
        skeleton: SMALL_TEXT_SKELETON
    },
    {
        key: 'stats.totalSize',
        title: 'Total Size',
        render: (_value, row) => formatSize(getTrajectoryRow(row)?.stats.totalSize ?? 0),
        skeleton: SMALL_TEXT_SKELETON
    },
    dateColumn<Trajectory>('createdAt', 'Created At', {
        width: 90,
        sortable: false
    }),
    dateColumn<Trajectory>('updatedAt', 'Updated At', {
        width: 90,
        sortable: false
    })
];

export default function TrajectoriesListing() {
    const navigate = useNavigate();
    const { fileInputRef, handlePickerChange, openFilePicker } = useTrajectoryFilePicker();
    const canCreate = usePermission(['trajectory:create']);
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { getMenuOptions } = useListingActions<Trajectory>({
        actions: {
            view: {
                label: 'View Scene',
                handler: ({ item: trajectory }) => navigate(`/canvas/${trajectory._id}`),
                requiredPermission: 'trajectory:read'
            },
            viewAtoms: {
                label: 'Inspect Atoms',
                icon: RiTableLine,
                handler: ({ item: trajectory }) => {
                    const firstTimestep = trajectory.frames[0].timestep;
                    navigate(`/dashboard/trajectory/${trajectory._id}/analysis/default/atoms/default?timestep=${firstTimestep}`);
                },
                requiredPermission: 'trajectory:read'
            },
            delete: {
                handler: async ({ item: trajectory }) => {
                    await runAction({
                        action: () => deleteTrajectoryMutation.mutateAsync(trajectory._id),
                        toast: DELETE_TRAJECTORY_TOAST
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete trajectory "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} trajectories? This action cannot be undone.`
                ),
                requiredPermission: 'trajectory:delete'
            }
        }
    });

    return (
        <DocumentListing<Trajectory>
            title='Trajectories'
            queryKey={TRAJECTORY_QUERY_KEYS.trajectoriesList({ page: 1, limit: 20 })}
            columns={COLUMNS}
            fetchData={fetchTrajectories}
            defaultLimit={20}
            getMenuOptions={getMenuOptions}
            emptyMessage='No trajectories found'
            socketInvalidation={SOCKET_INVALIDATION}
            headerActions={
                <>
                    <input
                        ref={fileInputRef}
                        type='file'
                        multiple
                        hidden
                        onChange={handlePickerChange}
                    />
                </>
            }
            createNew={canCreate ? {
                buttonTitle: 'Upload',
                onCreate: openFilePicker
            } : undefined}
        />
    );
}
