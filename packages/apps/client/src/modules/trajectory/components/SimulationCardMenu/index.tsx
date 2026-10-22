import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useDownloadTrajectory from '@/modules/trajectory/hooks/trajectory/use-download-trajectory';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { PromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { Crosshair, Download, EllipsisVertical, FolderInput, ListChecks, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import { useNavigate } from 'react-router-dom';

interface SimulationCardMenuProps {
    trajectoryId: string;
    name: string;
    isNavigable: boolean;
    onMoveToFolder?: () => void;
}

const DELETE_TRAJECTORY_TOAST: PromiseToastOptions<void> = {
    loading: { title: 'Deleting trajectory...' },
    success: { title: 'Trajectory deleted' },
    error: { title: 'Failed to delete trajectory' }
};

export default function SimulationCardMenu({
    trajectoryId,
    name,
    isNavigable,
    onMoveToFolder
}: SimulationCardMenuProps) {
    const navigate = useNavigate();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { downloadTrajectory, isDownloading: isExporting } = useDownloadTrajectory();
    const setJobsScope = useJobsDrawerStore((state) => state.setScope);
    const openSidePanel = useDashboardSidePanelStore((state) => state.open);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleViewScene = useCallback(() => {
        if (!isNavigable) {
            return;
        }
        navigate(`/canvas/${trajectoryId}`);
    }, [isNavigable, navigate, trajectoryId]);

    const handleOpenComputeJobs = useCallback(() => {
        setJobsScope({
            trajectoryId,
            trajectoryName: name
        });
        openSidePanel('jobs');
    }, [setJobsScope, openSidePanel, trajectoryId, name]);

    const handleExport = useCallback(() => {
        void downloadTrajectory({
            trajectoryId,
            filename: name || trajectoryId,
            archive: true
        });
    }, [downloadTrajectory, name, trajectoryId]);

    const handleDelete = useCallback(async () => {
        const isConfirmed = await confirm({
            title: `Delete trajectory "${name}"?`,
            description: 'This permanently deletes the trajectory and cannot be undone.',
            confirmText: 'Delete trajectory',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        setIsDeleting(true);

        try {
            await showPromise(
                deleteTrajectoryMutation.mutateAsync(trajectoryId),
                DELETE_TRAJECTORY_TOAST
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTrajectoryMutation, trajectoryId, name]);

    const options: MenuOption[] = [{
        onClick: handleViewScene,
        label: 'View scene',
        icon: Crosshair,
        disabled: !isNavigable
    }, {
        onClick: handleOpenComputeJobs,
        label: 'Compute jobs',
        icon: ListChecks
    }, {
        onClick: handleExport,
        label: 'Export',
        icon: Download,
        disabled: isExporting
    }, ...(onMoveToFolder ? [{
        onClick: onMoveToFolder,
        label: 'Move to folder',
        icon: FolderInput
    }] : []), {
        onClick: handleDelete,
        label: 'Delete',
        icon: Trash2,
        destructive: true,
        disabled: isDeleting
    }];

    return (
        <ContextMenuPopover
            id={`simulation-card-popover-${trajectoryId}`}
            trigger={(
                <button
                    type='button'
                    className='flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-canvas/70 text-muted transition-colors duration-150 hover:bg-canvas hover:text-foreground'
                    title={`Open actions for ${name}`}
                    aria-label={`Open actions for ${name}`}
                >
                    <EllipsisVertical size={16} />
                </button>
            )}
            options={options}
            triggerAction='click'
            placement='bottom-end'
            ariaLabel={`Actions for ${name}`}
            menuLabel={`Actions for ${name}`}
        />
    );
}
