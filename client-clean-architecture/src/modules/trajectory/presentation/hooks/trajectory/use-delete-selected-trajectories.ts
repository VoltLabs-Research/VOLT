import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useDeleteTrajectory from './use-delete-trajectory';

const useDeleteSelectedTrajectories = () => {
    const selectedIds = useTrajectoryStore((state) => state.selectedIds);
    const clearSelection = useTrajectoryStore((state) => state.clearSelection);
    const deleteTrajectory = useDeleteTrajectory();

    const deleteSelectedTrajectories = useCallback(async () => {
        await Promise.all(selectedIds.map(deleteTrajectory));
        clearSelection();
    }, [selectedIds, deleteTrajectory, clearSelection]);

    return deleteSelectedTrajectories;
};

export default useDeleteSelectedTrajectories;
