import { trajectoryQuery } from './queries';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { runCrudMutation } from '@/shared/presentation/hooks/toast';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { useCallback } from 'react';

export default function useDeleteSelectedTrajectories() {
    const { selectedIds, clearSelection } = useSelectionParams();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();

    const deleteSelectedTrajectories = useCallback(async () => {
        const isConfirmed = await confirm({
            title: selectedIds.length === 1 ? 'Delete selected trajectory?' : `Delete ${selectedIds.length} selected trajectories?`,
            description: 'This permanently deletes the selected trajectory data and cannot be undone.',
            confirmText: selectedIds.length === 1 ? 'Delete trajectory' : 'Delete trajectories',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        await runCrudMutation(
            Promise.all(selectedIds.map((id) => deleteTrajectoryMutation.mutateAsync(id))).then(clearSelection),
            { action: 'Deleting', subject: `${selectedIds.length} trajectories` }
        );
    }, [clearSelection, confirm, deleteTrajectoryMutation, selectedIds]);

    return deleteSelectedTrajectories;
}
