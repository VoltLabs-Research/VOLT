import { cn } from '@/shared/utils';
import { getStageMessage, isProcessingStatus } from '@/modules/trajectory/api/entities/trajectory';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import useTrajectoryPreview from '@/modules/trajectory/hooks/trajectory/use-trajectory-preview';
import Container from '@/shared/presentation/components/Container';
import SimulationCardFooter from '../../atoms/SimulationCardFooter';
import SimulationCardHeader from '../../atoms/SimulationCardHeader';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import { PiAtomThin } from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import './SimulationCard.css';

const NON_NAVIGABLE_CARD_TARGET_SELECTOR = [
    '.footer-options-btn',
    '[data-popover-trigger]',
    '[data-interactive-card-control="true"]',
    '.simulation-card-title'
].join(', ');

const shouldSkipCardNavigation = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
        return false;
    }

    return target.closest(NON_NAVIGABLE_CARD_TARGET_SELECTOR) !== null;
};

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (_id: string) => void;
    onMoveToFolder?: (trajectory: Trajectory) => void;
    onDelete?: (_id: string) => void;
    disablePrimaryInteraction?: boolean;
};

export default function SimulationCard({
    trajectory,
    isSelected,
    onSelect: _onSelect,
    onMoveToFolder,
    onDelete,
    disablePrimaryInteraction = false
}: SimulationCardProps) {
    const navigate = useNavigate();
    const createdBy = typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null;
    const completedRasterTrajectoryIds = useTeamJobsStore((state) => state.completedRasterTrajectoryIds);
    const hasRasterPreviewReadySignal = completedRasterTrajectoryIds.has(trajectory._id);
    const isProcessing = isProcessingStatus(trajectory.status);
    const hasPersistedPreview = trajectory.hasPreview === true;

    const { previewBlobUrl } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        isRasterReady: hasRasterPreviewReadySignal,
        allowPersistedPreviewFallback: hasPersistedPreview
    });

    const processingMessage = getStageMessage(trajectory.status);
    const cardAriaLabel = isSelected
        ? `Open selected trajectory ${trajectory.name}`
        : `Open trajectory ${trajectory.name}`;
    const canvasPath = `/canvas/${trajectory._id}`;

    const containerClass = cn(
        'simulation-card radius-md b-soft p-relative',
        !disablePrimaryInteraction && 'cursor-pointer',
        isProcessing && 'has-jobs',
        isSelected && 'is-selected'
    );

    const handleClick = (event: MouseEvent<HTMLElement>): void => {
        if (shouldSkipCardNavigation(event.target)) {
            return;
        }

        navigate(canvasPath);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        if (shouldSkipCardNavigation(event.target)) {
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        navigate(canvasPath);
    };

    return (
        <article
            className={containerClass}
            onClick={disablePrimaryInteraction ? undefined : handleClick}
            onKeyDown={disablePrimaryInteraction ? undefined : handleKeyDown}
            tabIndex={disablePrimaryInteraction ? undefined : 0}
            role={disablePrimaryInteraction ? undefined : 'link'}
            aria-label={disablePrimaryInteraction ? undefined : cardAriaLabel}
            aria-busy={isProcessing}
        >
            <Container className='d-flex flex-center overflow-hidden p-relative w-max cover-container radius-md'>
                {previewBlobUrl ? (
                    <img
                        className='w-max h-max cover-image'
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory.name}`}
                    />
                ) : (
                    <Container className='d-flex flex-center w-max h-max color-muted font-size-5-5'>
                        <PiAtomThin />
                    </Container>
                )}
            </Container>

            <SimulationCardHeader
                user={createdBy}
            />

            <SimulationCardFooter
                trajectoryId={trajectory._id}
                name={trajectory.name}
                updatedAt={trajectory.updatedAt}
                isProcessing={isProcessing}
                processingMessage={processingMessage}
                onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(trajectory) : undefined}
                onDelete={onDelete}
            />

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </article>
    );
}
