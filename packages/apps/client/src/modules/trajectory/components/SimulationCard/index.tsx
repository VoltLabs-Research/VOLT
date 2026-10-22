import { getStageMessage, isProcessingStatus, isTrajectoryNavigable } from '@/modules/trajectory/utils/trajectory-status';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import useTrajectoryPreview from './use-trajectory-preview';
import SimulationCardFooter from '../SimulationCardFooter';
import SimulationCardMenu from '../SimulationCardMenu';
import { cn } from '@heroui/react';
import { Atom } from 'lucide-react';
import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { useNavigate } from 'react-router-dom';

const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onMoveToFolder?: (trajectory: Trajectory) => void;
    readOnly?: boolean;
    discoverTeamId?: string;
}

export default function SimulationCard({
    trajectory,
    isSelected,
    onMoveToFolder,
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
    const canOpen = isTrajectoryNavigable(trajectory.status);
    const hasPersistedPreview = trajectory.hasPreview === true;

    const { previewBlobUrl } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        isRasterReady: hasRasterPreviewReadySignal,
        allowPersistedPreviewFallback: hasPersistedPreview,
        accessMode: readOnly ? 'public' : 'rbac'
    });

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

    const openCanvas = (): void => {
        navigate(canvasPath, canvasNavigationOptions);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        // The name inside is editable, and handles its own keys.
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
        }

        event.preventDefault();
        openCanvas();
    };

    // A transparent, bordered card: the preview fills it and the title and caption sit at its foot,
    // in the theme's colours. The menu is a sibling of the link, so its clicks never open the canvas.
    return (
        <article className='group/card relative min-w-0' aria-busy={isProcessing}>
            <div
                className={cn('relative h-64 overflow-hidden rounded-3xl border border-border outline-offset-2 transition-colors duration-200 hover:border-border-secondary', canOpen && 'cursor-pointer', isSelected && 'outline-2 outline-foreground')}
                onClick={canOpen ? openCanvas : undefined}
                onKeyDown={canOpen ? handleKeyDown : undefined}
                tabIndex={canOpen ? 0 : undefined}
                role={canOpen ? 'link' : undefined}
                aria-label={canOpen ? cardAriaLabel : undefined}
            >
                {previewBlobUrl ? (
                    <img
                        className='absolute inset-0 size-full object-cover transition-transform duration-500 ease-(--ease-emphasized) group-hover/card:scale-105 motion-reduce:transition-none'
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory.name}`}
                    />
                ) : (
                    <div className='absolute inset-0 flex items-center justify-center text-muted'>
                        <Atom size={24} />
                    </div>
                )}
                <SimulationCardFooter
                    trajectoryId={trajectory._id}
                    name={trajectory.name}
                    updatedAt={trajectory.updatedAt}
                    atoms={trajectory.atoms}
                    framesCount={trajectory.framesCount ?? trajectory.frames?.length ?? 0}
                    isProcessing={isProcessing}
                    processingMessage={getStageMessage(trajectory.status)}
                    readOnly={readOnly}
                />
            </div>

            {!readOnly && (
                <div className='absolute top-3 right-3 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100'>
                    <SimulationCardMenu
                        trajectoryId={trajectory._id}
                        name={trajectory.name}
                        isNavigable={canOpen}
                        onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(trajectory) : undefined}
                    />
                </div>
            )}
        </article>
    );
}
