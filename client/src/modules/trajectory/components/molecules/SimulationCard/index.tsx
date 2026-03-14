import { getStageMessage, isProcessingStatus } from '@/modules/trajectory/api/entities/trajectory';
import useTrajectoryPreview from '@/modules/trajectory/hooks/trajectory/use-trajectory-preview';
import { formatNumber, formatSize } from '@/shared/utils/format';
import SimulationCardFooter from '../../atoms/SimulationCardFooter';
import SimulationCardHeader from '../../atoms/SimulationCardHeader';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import { cn } from '@/shared/utils';
import { PiAtomThin } from 'react-icons/pi';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import Container from '@/shared/presentation/components/Container';
import './SimulationCard.css';

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (_id: string) => void;
    onDelete?: (_id: string) => void;
};

export default function SimulationCard({ trajectory, isSelected, onSelect, onDelete }: SimulationCardProps) {
    const navigate = useNavigate();

    const { previewBlobUrl, isLoading: previewLoading, error: previewError, retry: retryPreview } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        version: trajectory.updatedAt,
        enabled: trajectory.status !== 'failed'
    });

    const isProcessing = isProcessingStatus(trajectory.status);
    const processingMessage = getStageMessage(trajectory.status);

    const isInteractiveTarget = (target: EventTarget | null) => {
        return target instanceof Element
            && Boolean(target.closest('button, a, input, select, textarea, [data-popover-trigger]'));
    };

    const containerClass = cn(
        'simulation-card cursor-pointer radius-md b-soft p-relative',
        isProcessing && 'has-jobs',
        isSelected && 'is-selected'
    );

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (isInteractiveTarget(e.target)) {
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            onSelect(trajectory._id);
        } else {
            navigate(`/canvas/${trajectory._id}/`);
        }
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

    const showPreview = previewBlobUrl && !previewError;
    const showPlaceholder = !showPreview || previewLoading;
    const atomCount = trajectory.frames[0]?.natoms ?? 0;

    return (
        <article
            className={containerClass}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role='link'
            aria-label={`Open trajectory ${trajectory.name}`}
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
                        onError={retryPreview}
                    />
                )}
            </Container>

            <SimulationCardHeader 
                user={typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null}
                createdAt={trajectory.createdAt}
            />

            <SimulationCardFooter
                trajectoryId={trajectory._id}
                name={trajectory.name}
                createdBy={typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null}
                createdAt={trajectory.createdAt}
                updatedAt={trajectory.updatedAt}
                isProcessing={isProcessing}
                processingMessage={processingMessage}
                atomCount={formatNumber(atomCount)}
                frameCount={formatNumber(trajectory.frames.length)}
                totalSize={formatSize(trajectory.stats.totalSize)}
                onDelete={onDelete}
            />

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </article>
    );
}
