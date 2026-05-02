import EditableTrajectoryName from '../EditableTrajectoryName';
import { JobStatus } from '@/modules/jobs/api/entities/job';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { useTriggerRasterizationMutation } from '@/modules/raster/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Loader from '@/shared/presentation/primitives/Loader';
import Popover from '@/shared/presentation/primitives/Popover';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/primitives/PopoverMenuItem';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { FolderInput, Play, ScanSearch } from 'lucide-react';
import { sileo } from 'sileo';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/api/entities/job';
import './SimulationCardFooter.css';
import { useNavigate } from 'react-router-dom';
interface SimulationCardFooterProps {
    trajectoryId: string;
    name: string;
    updatedAt: string;
    isProcessing: boolean;
    processingMessage?: string;
    onMoveToFolder?: () => void;
    onDelete?: (_id: string) => void;
}

interface ToastState {
    title: string;
    description?: string;
}

interface ToastStateResolver<T> {
    (_data: T): ToastState;
}

interface PromiseToastConfig<T> {
    loading: ToastState;
    success: ToastState | ToastStateResolver<T>;
    error: ToastState;
}

interface SimulationCardActionItem {
    icon: ReactNode;
    label: string;
    onClick: () => void;
    isDanger?: boolean;
    isLoading?: boolean;
    disabled?: boolean;
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

const DELETE_TRAJECTORY_TOAST: PromiseToastConfig<void> = {
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

const RASTERIZE_TRAJECTORY_TOAST: PromiseToastConfig<RasterizeTrajectoryToastResult> = {
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

    for (const group of groups ?? []) {
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
    processingMessage,
    onMoveToFolder,
    onDelete
}: SimulationCardFooterProps) {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const deleteTrajectoryMutation = trajectoryQuery.useDeleteMutation();
    const triggerRasterizationMutation = useTriggerRasterizationMutation();
    const { data: jobGroups = [] } = teamJobsGroups();
    const requestedRasterTrajectoryIds = useTeamJobsStore((state) => state.requestedRasterTrajectoryIds);
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
        navigate(`/canvas/${trajectoryId}`);
    }, [navigate, trajectoryId]);

    const handleViewRaster = useCallback(() => {
        navigate(`/canvas/${trajectoryId}?workspace=raster`);
    }, [navigate, trajectoryId]);

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
    }, [deleteTrajectoryMutation, confirm, trajectoryId, name, onDelete]);

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

    const popoverItems: SimulationCardActionItem[] = [{
        onClick: handleViewScene,
        label: 'View scene',
        icon: <HiOutlineViewfinderCircle />
    }, {
        onClick: handleViewRaster,
        label: 'Open raster workspace',
        icon: <ScanSearch />
    }, ...(onMoveToFolder ? [{
        onClick: onMoveToFolder,
        label: 'Move to folder',
        icon: <FolderInput />
    }] : []), {
        onClick: handleRasterizeTrajectory,
        label: 'Rasterize trajectory',
        icon: <Play />,
        isLoading: isRasterizing,
        disabled: isRasterizeDisabled
    }, {
        onClick: handleDelete,
        label: 'Delete',
        icon: <RxTrash />,
        isDanger: true,
        isLoading: isDeleting
    }];

    const popoverTrigger = (
        <IconButton
            className='footer-options-btn'
            title={`Open actions for ${name}`}
            aria-label={`Open actions for ${name}`}
        >
            <PiDotsThreeVerticalBold />
        </IconButton>
    );

    return (
        <Row gap='05' zIndex='10' p='1-5' position='absolute' bottom='0' left='0' right='0' className='simulation-card-footer'>
            <Stack gap='05' flex='1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='simulation-card-title font-size-3 color-primary font-weight-5 text-truncate'
                    allowSingleClickPropagation
                />
                <Row gap='075' className='simulation-card-status color-secondary font-size-2'>
                    {isProcessing ? (
                        <>
                            <Loader scale={0.4} isFixed={false} className='simulation-card-status-loader f-shrink-0' />
                            <Text as='p' className='simulation-card-status-text' title={processingMessage}>
                                {processingMessage}
                            </Text>
                        </>
                    ) : (
                        <Text as='p' className='simulation-card-status-text' title={updatedLabel}>
                            {updatedLabel}
                        </Text>
                    )}
                </Row>
            </Stack>

            <Popover
                id={`simulation-card-popover-${trajectoryId}`}
                trigger={popoverTrigger}
            >
                <PopoverMenu>
                    {popoverItems.map(({ icon, onClick, label, isDanger, ...props }, index) => (
                        <PopoverMenuItem
                            icon={icon}
                            label={label}
                            onClick={onClick}
                            key={index}
                            variant={isDanger ? 'danger' : undefined}
                            {...props}
                        />
                    ))}
                </PopoverMenu>
            </Popover>
        </Row>
    );
}
