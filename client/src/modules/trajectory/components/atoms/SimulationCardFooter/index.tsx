import EditableTrajectoryName from '../EditableTrajectoryName';
import { useTriggerRasterizationMutation } from '@/modules/raster/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { FolderInput, Play, ScanSearch } from 'lucide-react';
import { sileo } from 'sileo';
import { HiOutlineViewfinderCircle } from 'react-icons/hi2';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from 'react-icons/rx';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './SimulationCardFooter.css';

interface SimulationCardFooterProps {
    trajectoryId: string;
    name: string;
    updatedAt: string;
    isProcessing: boolean;
    processingMessage?: string;
    onMoveToFolder?: () => void;
    onDelete?: (_id: string) => void;
};

interface ToastState {
    title: string;
    description?: string;
};

interface ToastStateResolver<T> {
    (_data: T): ToastState;
};

interface PromiseToastConfig<T> {
    loading: ToastState;
    success: ToastState | ToastStateResolver<T>;
    error: ToastState;
};

interface SimulationCardActionItem {
    icon: ReactNode;
    label: string;
    onClick: () => void;
    isDanger?: boolean;
    isLoading?: boolean;
    disabled?: boolean;
};

interface RasterizeTrajectoryToastResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
};

interface RasterizationJobStatusCounts {
    pending: number;
};

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

/** Counts raster jobs already pending for a trajectory in Jobs History state. */
const getRasterizationJobStatusCounts = (pendingRasterKeys: Set<string>, trajectoryId: string): RasterizationJobStatusCounts => {
    let pending = 0;

    for (const pendingKey of pendingRasterKeys) {
        if (!pendingKey.startsWith(`${trajectoryId}:`)) {
            continue;
        }

        pending += 1;
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
    const pendingRasterKeys = useTeamJobsStore((state) => state.pendingRasterKeys);
    const inFlightRasterTrajectoryIds = useTeamJobsStore((state) => state.inFlightRasterTrajectoryIds);
    const [isDeleting, setIsDeleting] = useState(false);
    const updatedLabel = `Edited ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}`;
    const isRasterizing = triggerRasterizationMutation.isPending;
    const rasterizationJobStatusCounts = getRasterizationJobStatusCounts(pendingRasterKeys, trajectoryId);
    const hasPendingRasterization = rasterizationJobStatusCounts.pending > 0;
    const hasInFlightRasterizationRequest = inFlightRasterTrajectoryIds.has(trajectoryId);
    const isRasterizeDisabled = !teamId || isRasterizing || isProcessing || hasPendingRasterization || hasInFlightRasterizationRequest;

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

        if (hasPendingRasterization || hasInFlightRasterizationRequest) {
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
    }, [hasInFlightRasterizationRequest, hasPendingRasterization, isProcessing, isRasterizing, teamId, trajectoryId, triggerRasterizationMutation]);

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
        <Container className='simulation-card-footer z-10 p-1-5 d-flex items-center gap-05 p-absolute bottom-0 left-0 right-0'>
            <Container className='d-flex column gap-05 flex-1'>
                <EditableTrajectoryName
                    trajectoryId={trajectoryId}
                    name={name}
                    className='simulation-card-title font-size-3 color-primary font-weight-5 text-truncate'
                    allowSingleClickPropagation
                />
                <Container className='simulation-card-status d-flex items-center gap-075 color-secondary font-size-2'>
                    {isProcessing ? (
                        <>
                            <Loader scale={0.4} isFixed={false} className='simulation-card-status-loader f-shrink-0' />
                            <Paragraph className='simulation-card-status-text' title={processingMessage}>
                                {processingMessage}
                            </Paragraph>
                        </>
                    ) : (
                        <Paragraph className='simulation-card-status-text' title={updatedLabel}>
                            {updatedLabel}
                        </Paragraph>
                    )}
                </Container>
            </Container>

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
        </Container>
    );
}
