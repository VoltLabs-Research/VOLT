import { cn } from '@/shared/utils/cn';
import { getStageMessage, isProcessingStatus, isTrajectoryNavigable } from '@/modules/trajectory/utils/trajectory-status';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import useTrajectoryPreview from '@/modules/trajectory/hooks/trajectory/use-trajectory-preview';
import SimulationCardFooter from '../SimulationCardFooter';
import { Atom } from 'lucide-react';
import { useMemo } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { useNavigate } from 'react-router-dom';

const NON_NAVIGABLE_CARD_TARGET_SELECTOR = [
    '.footer-options-btn',
    '[data-popover-trigger^="simulation-card-popover-"]'
].join(', ');
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const shouldSkipCardNavigation = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
        return false;
    }

    return target.closest(NON_NAVIGABLE_CARD_TARGET_SELECTOR) !== null;
};

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onMoveToFolder?: (trajectory: Trajectory) => void;
    onDelete?: (_id: string) => void;
    disablePrimaryInteraction?: boolean;
    readOnly?: boolean;
    discoverTeamId?: string;
}

export default function SimulationCard({
    trajectory,
    isSelected,
    onMoveToFolder,
    onDelete,
    disablePrimaryInteraction = false,
    readOnly = false,
    discoverTeamId
}: SimulationCardProps) {
    const navigate = useNavigate();
    const { data: jobGroups = [] } = teamJobsGroups();
    const hasRasterPreviewReadySignal = useMemo(() => {
        for (const group of jobGroups) {
            if (group.trajectoryId !== trajectory._id) {
                continue;
            }

            for (const frameGroup of group.frameGroups) {
                const hasCompletedRasterJob = frameGroup.jobs.some((job) => {
                    return job.queueType === RASTER_QUEUE_TYPE && job.status === JobStatus.Completed;
                });

                if (hasCompletedRasterJob) {
                    return true;
                }
            }
        }

        return false;
    }, [jobGroups, trajectory._id]);
    const isProcessing = isProcessingStatus(trajectory.status);
    const isNavigable = isTrajectoryNavigable(trajectory.status);
    const canOpen = isNavigable && !disablePrimaryInteraction;
    const hasPersistedPreview = trajectory.hasPreview === true;

    const { previewBlobUrl } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        isRasterReady: hasRasterPreviewReadySignal,
        allowPersistedPreviewFallback: hasPersistedPreview,
        accessMode: readOnly ? 'public' : 'rbac'
    });

    const processingMessage = getStageMessage(trajectory.status);
    const cardAriaLabel = isSelected
        ? `Open selected trajectory ${trajectory.name}`
        : `Open trajectory ${trajectory.name}`;
    const canvasPath = `/canvas/${trajectory._id}`;
    const canvasNavigationOptions = discoverTeamId
        ? {
            state: {
                entry: 'discover-team',
                teamId: discoverTeamId
            }
        }
        : undefined;

    const handleClick = (event: MouseEvent<HTMLElement>): void => {
        const shouldSkipNavigation = shouldSkipCardNavigation(event.target);

        if (shouldSkipNavigation) {
            return;
        }

        navigate(canvasPath, canvasNavigationOptions);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        if (shouldSkipCardNavigation(event.target)) {
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        navigate(canvasPath, canvasNavigationOptions);
    };

    return (
        <article
            className={cn(
                'simulation-card group/card relative flex h-full flex-col overflow-hidden rounded-xl border border-border transition-[background-color,border-color,box-shadow] duration-[250ms] hover:border-border-secondary',
                canOpen && 'cursor-pointer',
                isProcessing && 'has-jobs',
                isSelected && 'is-selected border-accent bg-[color-mix(in_srgb,var(--surface-secondary)_90%,var(--info-soft))]'
            )}
            onClick={canOpen ? handleClick : undefined}
            onKeyDown={canOpen ? handleKeyDown : undefined}
            tabIndex={canOpen ? 0 : undefined}
            role={canOpen ? 'link' : undefined}
            aria-label={canOpen ? cardAriaLabel : undefined}
            aria-busy={isProcessing}
        >
            <div className='relative flex h-[200px] w-full flex-row items-center justify-center overflow-hidden rounded-xl'>
                {previewBlobUrl ? (
                    <img
                        className='block h-full w-full object-cover'
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory.name}`}
                    />
                ) : (
                    <div className='flex flex-row items-center w-full h-full justify-center text-muted text-[1.8rem]'>
                        <Atom />
                    </div>
                )}
            </div>
            <SimulationCardFooter
                trajectoryId={trajectory._id}
                name={trajectory.name}
                updatedAt={trajectory.updatedAt}
                isProcessing={isProcessing}
                isNavigable={isNavigable}
                processingMessage={processingMessage}
                onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(trajectory) : undefined}
                onDelete={onDelete}
                readOnly={readOnly}
            />
        </article>
    );
}
