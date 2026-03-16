import { cn } from '@/shared/utils';
import { getStageMessage, isProcessingStatus } from '@/modules/trajectory/api/entities/trajectory';
import useTrajectoryPreview from '@/modules/trajectory/hooks/trajectory/use-trajectory-preview';
import Container from '@/shared/presentation/components/Container';
import SimulationCardFooter from '../../atoms/SimulationCardFooter';
import SimulationCardHeader from '../../atoms/SimulationCardHeader';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import React, { useCallback } from 'react';
import { PiAtomThin } from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import './SimulationCard.css';

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (_id: string) => void;
    onDelete?: (_id: string) => void;
};

export default function SimulationCard({ trajectory, isSelected, onSelect, onDelete }: SimulationCardProps) {
    const navigate = useNavigate();
    const createdBy = typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null;

    const { previewBlobUrl } = useTrajectoryPreview({
        trajectoryId: trajectory._id
    });

    const isProcessing = isProcessingStatus(trajectory.status);
    const processingMessage = getStageMessage(trajectory.status);
    const cardAriaLabel = isSelected
        ? `Open selected trajectory ${trajectory.name}`
        : `Open trajectory ${trajectory.name}`;

    const isInteractiveTarget = (target: EventTarget | null) => {
        return target instanceof Element
            && Boolean(target.closest('button, a, input, select, textarea, [data-popover-trigger], [data-interactive-card-control="true"]'));
    };

    const containerClass = cn(
        'simulation-card cursor-pointer radius-md b-soft p-relative',
        isProcessing && 'has-jobs',
        isSelected && 'is-selected'
    );

    const handleClick = useCallback((event: React.MouseEvent) => {
        if (isInteractiveTarget(event.target)) {
            return;
        }

        if (event.metaKey || event.ctrlKey) {
            onSelect(trajectory._id);
            return;
        }

        navigate(`/canvas/${trajectory._id}/`);
    }, [navigate, onSelect, trajectory._id]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (isInteractiveTarget(event.target)) {
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();

        if (event.metaKey || event.ctrlKey) {
            onSelect(trajectory._id);
            return;
        }

        navigate(`/canvas/${trajectory._id}/`);
    }, [navigate, onSelect, trajectory._id]);

    const showPreview = Boolean(previewBlobUrl);
    const showPlaceholder = !showPreview;

    return (
        <article
            className={containerClass}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role='link'
            aria-label={cardAriaLabel}
            aria-busy={isProcessing}
        >
            <Container className='d-flex flex-center overflow-hidden p-relative w-max cover-container radius-md'>
                {showPlaceholder && (
                    <Container className='d-flex flex-center w-max h-max color-muted font-size-5-5'>
                        <PiAtomThin />
                    </Container>
                )}
                {showPreview && (
                    <img
                        className='w-max h-max cover-image'
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory.name}`}
                    />
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
                onDelete={onDelete}
            />

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </article>
    );
}
