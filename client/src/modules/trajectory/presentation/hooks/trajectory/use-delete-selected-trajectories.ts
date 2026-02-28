import { useCallback } from 'react';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import useDeleteTrajectory from './use-delete-trajectory';
import { showPromise } from '@/shared/presentation/hooks/toast';

const useDeleteSelectedTrajectories = () => {
    const { selectedIds, clearSelection } = useSelectionParams();
    const deleteTrajectory = useDeleteTrajectory();

    const deleteSelectedTrajectories = useCallback(async () => {
        await showPromise(
            Promise.all(selectedIds.map(deleteTrajectory)).then(() => clearSelection()),
            {
                loading: { title: `Deleting ${selectedIds.length} trajectories...` },
                success: { title: `${selectedIds.length} trajectories deleted` },
                error: { title: 'Failed to delete trajectories' }
            }
        );
    }, [selectedIds, deleteTrajectory, clearSelection]);

    return deleteSelectedTrajectories;
};

export default useDeleteSelectedTrajectories;
