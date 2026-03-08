import { useCallback } from 'react';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { trajectoryQuery } from './trajectory/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';

const useDeleteSelectedTrajectories = () => {
    const { selectedIds, clearSelection } = useSelectionParams();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();

    const deleteSelectedTrajectories = useCallback(async () => {
        await showPromise(
            Promise.all(selectedIds.map((id) => deleteTrajectoryMutation.mutateAsync(id))).then(() => clearSelection()),
            {
                loading: { title: `Deleting ${selectedIds.length} trajectories...` },
                success: { title: `${selectedIds.length} trajectories deleted` },
                error: { title: 'Failed to delete trajectories' }
            }
        );
    }, [selectedIds, deleteTrajectoryMutation, clearSelection]);

    return deleteSelectedTrajectories;
};

export default useDeleteSelectedTrajectories;
