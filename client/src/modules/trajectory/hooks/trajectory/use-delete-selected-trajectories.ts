import { trajectoryQuery } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { useCallback } from 'react';

interface ToastState {
    title: string;
};

export default function useDeleteSelectedTrajectories() {
    const { selectedIds, clearSelection } = useSelectionParams();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();

    const deleteSelectedTrajectories = useCallback(async () => {
        const toastConfig = {
            loading: { title: `Deleting ${selectedIds.length} trajectories...` },
            success: { title: `${selectedIds.length} trajectories deleted` },
            error: { title: 'Failed to delete trajectories' }
        } satisfies {
            loading: ToastState;
            success: ToastState;
            error: ToastState;
        };

        await showPromise(
            Promise.all(selectedIds.map((id) => deleteTrajectoryMutation.mutateAsync(id))).then(clearSelection),
            toastConfig
        );
    }, [selectedIds, deleteTrajectoryMutation, clearSelection]);

    return deleteSelectedTrajectories;
}
