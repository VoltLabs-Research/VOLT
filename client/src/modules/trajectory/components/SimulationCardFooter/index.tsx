import Loader from '@/shared/ui/components/Loader';
import EditableTrajectoryName from '../EditableTrajectoryName';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useDownloadTrajectory from '@/modules/trajectory/hooks/trajectory/use-download-trajectory';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';

import { showPromise } from '@/shared/ui/hooks/toast';
import type { PromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { formatDistanceToNow } from 'date-fns';
import { Crosshair, Download, EllipsisVertical, FolderInput, ListChecks, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import { useNavigate } from 'react-router-dom';

interface SimulationCardFooterProps {
    trajectoryId: string;
    name: string;
    updatedAt: string;
    isProcessing: boolean;
    isNavigable: boolean;
    processingMessage?: string;
    onMoveToFolder?: () => void;
    onDelete?: (_id: string) => void;
    readOnly?: boolean;
}

const DELETE_TRAJECTORY_TOAST: PromiseToastOptions<void> = {
    loading: { title: 'Deleting trajectory...' },
    success: { title: 'Trajectory deleted' },
    error: { title: 'Failed to delete trajectory' }
};

export default function SimulationCardFooter({
    trajectoryId,
    name,
    updatedAt,
    isProcessing,
    isNavigable,
    processingMessage,
    onMoveToFolder,
    onDelete,
    readOnly = false
}: SimulationCardFooterProps) {
    const navigate = useNavigate();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const { downloadTrajectory, isDownloading: isExporting } = useDownloadTrajectory();
    const setJobsScope = useJobsDrawerStore((state) => state.setScope);
    const openSidePanel = useDashboardSidePanelStore((state) => state.open);
    const [isDeleting, setIsDeleting] = useState(false);
    const updatedLabel = `Edited ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`;

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
            onDelete?.(trajectoryId);
            await showPromise(
                deleteTrajectoryMutation.mutateAsync(trajectoryId),
                DELETE_TRAJECTORY_TOAST
            );
        } finally {
            setIsDeleting(false);
        }
    }, [deleteTrajectoryMutation, trajectoryId, name, onDelete]);

    const popoverItems: MenuOption[] = readOnly ? [] : [{
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

    const popoverTrigger = (
        <button
            type='button'
            className='footer-options-btn flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-foreground/8 hover:text-foreground'
            title={`Open actions for ${name}`}
            aria-label={`Open actions for ${name}`}
        >
            <EllipsisVertical size={20} />
        </button>
    );

    return (
        <div className="simulation-card-footer absolute bottom-0 left-0 right-0 z-10 flex w-full flex-row items-center gap-2 p-4 before:pointer-events-none before:absolute before:-top-12 before:right-0 before:bottom-0 before:left-0 before:-z-[1] before:rounded-[inherit] before:content-[''] before:bg-[linear-gradient(to_top,color-mix(in_srgb,var(--background)_100%,transparent)_0%,color-mix(in_srgb,var(--background)_72%,transparent)_40%,transparent_100%)]">
            <div className='flex flex-col gap-2 flex-1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='truncate text-base font-medium leading-[1.2] text-foreground'
                    allowSingleClickPropagation
                    readOnly={readOnly}
                />
                <div className='flex flex-row flex-wrap items-center gap-3 text-sm text-muted'>
                    {isProcessing ? (
                        <>
                            <Loader size='sm' className='ml-2 shrink-0 pr-2' />
                            <p className='m-0 leading-[1.35]' title={processingMessage}>
                                {processingMessage}
                            </p>
                        </>
                    ) : (
                        <p className='m-0 leading-[1.35]' title={updatedLabel}>
                            {updatedLabel}
                        </p>
                    )}
                </div>
            </div>

            {!readOnly && (
                <ContextMenuPopover
                    id={`simulation-card-popover-${trajectoryId}`}
                    trigger={popoverTrigger}
                    options={popoverItems}
                    triggerAction='click'
                    placement='bottom-end'
                    ariaLabel={`Actions for ${name}`}
                    menuLabel={`Actions for ${name}`}
                />
            )}
        </div>
    );
}
