import Loader from '@/shared/ui/components/Loader';
import EditableTrajectoryName from '../EditableTrajectoryName';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { useTriggerRasterizationMutation } from '@/modules/raster/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useDownloadTrajectory from '@/modules/trajectory/hooks/trajectory/use-download-trajectory';
import useTeamJobsStore from '@/modules/jobs/store/use-team-jobs-store';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';

import { showPromise } from '@/shared/ui/hooks/toast';
import type { PromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { formatDistanceToNow } from 'date-fns';
import { Crosshair, Download, EllipsisVertical, FolderInput, ListChecks, Play, ScanSearch, Trash2 } from 'lucide-react';
import { sileo } from 'sileo';
import { useCallback, useMemo, useState } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import type { TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';
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

interface RasterizeTrajectoryToastResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}

interface RasterizationJobStatusCounts {
    pending: number;
}

const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const DELETE_TRAJECTORY_TOAST: PromiseToastOptions<void> = {
    loading: { title: 'Deleting trajectory...' },
    success: { title: 'Trajectory deleted' },
    error: { title: 'Failed to delete trajectory' }
};

const getRasterizeSuccessTitle = (data: RasterizeTrajectoryToastResult): string => {
    if (data.queuedJobs > 0) {
        return data.queuedJobs === 1
            ? 'Rasterization queued for 1 frame'
            : `Rasterization queued for ${data.queuedJobs} frames`;
    }

    if (data.alreadyRasterizedJobs > 0 && data.duplicateJobs === 0) {
        return data.alreadyRasterizedJobs === 1
            ? '1 frame was already rasterized'
            : `${data.alreadyRasterizedJobs} frames were already rasterized`;
    }

    return 'Rasterization request processed';
};

const getRasterizeSuccessDescription = (data: RasterizeTrajectoryToastResult): string | undefined => {
    if (data.queuedJobs > 0 && data.skippedJobs > 0) {
        const skippedReason = data.duplicateJobs > 0
            ? `${data.duplicateJobs} already queued/running`
            : `${data.alreadyRasterizedJobs} already rasterized`;

        return `${data.skippedJobs} frame${data.skippedJobs === 1 ? ' was' : 's were'} skipped (${skippedReason}).`;
    }

    if (data.alreadyRasterizedJobs > 0 && data.duplicateJobs === 0) {
        return 'No new worker jobs were enqueued.';
    }

    return undefined;
};

const RASTERIZE_TRAJECTORY_TOAST: PromiseToastOptions<RasterizeTrajectoryToastResult> = {
    loading: { title: 'Queueing rasterization...' },
    success: (data) => ({
        title: getRasterizeSuccessTitle(data),
        description: getRasterizeSuccessDescription(data)
    }),
    error: { title: 'Failed to rasterize trajectory' }
};

const isPendingRasterJobStatus = (status: JobStatus): boolean => {
    return status !== JobStatus.Completed && status !== JobStatus.Failed;
};

const getRasterizationJobStatusCounts = (
    groups: TrajectoryJobGroup[],
    trajectoryId: string
): RasterizationJobStatusCounts => {
    let pending = 0;

    for (const group of groups) {
        if (group.trajectoryId !== trajectoryId) {
            continue;
        }

        for (const frameGroup of group.frameGroups) {
            for (const job of frameGroup.jobs) {
                if (job.queueType !== RASTER_QUEUE_TYPE || !isPendingRasterJobStatus(job.status)) {
                    continue;
                }

                pending += 1;
            }
        }
    }

    return {
        pending
    };
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
    const teamId = useSelectedTeamId();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const triggerRasterizationMutation = useTriggerRasterizationMutation();
    const { downloadTrajectory, isDownloading: isExporting } = useDownloadTrajectory();
    const { data: jobGroups = [] } = teamJobsGroups();
    const requestedRasterTrajectoryIds = useTeamJobsStore((state) => state.requestedRasterTrajectoryIds);
    const setJobsScope = useJobsDrawerStore((state) => state.setScope);
    const openSidePanel = useDashboardSidePanelStore((state) => state.open);
    const [isDeleting, setIsDeleting] = useState(false);
    const updatedLabel = `Edited ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`;
    const isRasterizing = triggerRasterizationMutation.isPending;
    const rasterizationJobStatusCounts = useMemo(() => {
        return getRasterizationJobStatusCounts(jobGroups, trajectoryId);
    }, [jobGroups, trajectoryId]);
    const hasPendingRasterization = rasterizationJobStatusCounts.pending > 0;
    const hasRequestedRasterization = requestedRasterTrajectoryIds.has(trajectoryId);
    const isRasterizeDisabled = !teamId || isRasterizing || isProcessing || hasPendingRasterization || hasRequestedRasterization;

    const handleViewScene = useCallback(() => {
        if (!isNavigable) {
            return;
        }
        navigate(`/canvas/${trajectoryId}`);
    }, [isNavigable, navigate, trajectoryId]);

    const handleViewRaster = useCallback(() => {
        if (!isNavigable) {
            return;
        }
        navigate(`/canvas/${trajectoryId}?workspace=raster`);
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

    const handleRasterizeTrajectory = useCallback(async () => {
        if (!teamId || isRasterizing || isProcessing) {
            return;
        }

        if (hasPendingRasterization || hasRequestedRasterization) {
            sileo.info({
                title: 'Rasterization already in progress',
                description: 'Wait for the current worker jobs to finish before queueing the same trajectory again.'
            });
            return;
        }

        await showPromise(
            triggerRasterizationMutation.mutateAsync({
                teamId,
                trajectoryId
            }),
            RASTERIZE_TRAJECTORY_TOAST
        );
    }, [hasPendingRasterization, hasRequestedRasterization, isProcessing, isRasterizing, teamId, trajectoryId, triggerRasterizationMutation]);

    const popoverItems: MenuOption[] = readOnly ? [] : [{
        onClick: handleViewScene,
        label: 'View scene',
        icon: Crosshair,
        disabled: !isNavigable
    }, {
        onClick: handleViewRaster,
        label: 'Open raster workspace',
        icon: ScanSearch,
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
        onClick: handleRasterizeTrajectory,
        label: 'Rasterize trajectory',
        icon: Play,
        disabled: isRasterizeDisabled
    }, {
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
