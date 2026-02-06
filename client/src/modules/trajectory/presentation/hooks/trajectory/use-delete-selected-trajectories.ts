import { useCallback } from 'react';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import useDeleteTrajectory from './use-delete-trajectory';

const useDeleteSelectedTrajectories = () => {
    const { selectedIds, clearSelection } = useSelectionParams();
    const deleteTrajectory = useDeleteTrajectory();

    const deleteSelectedTrajectories = useCallback(async () => {
        await Promise.all(selectedIds.map(deleteTrajectory));
        clearSelection();
    }, [selectedIds, deleteTrajectory, clearSelection]);

    return deleteSelectedTrajectories;
};

export default useDeleteSelectedTrajectories;
