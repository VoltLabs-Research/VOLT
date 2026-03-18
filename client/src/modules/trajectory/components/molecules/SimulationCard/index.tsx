import { cn } from '@/shared/utils';
import { getStageMessage, isProcessingStatus } from '@/modules/trajectory/api/entities/trajectory';
import useTeamJobsStore from '@/modules/jobs/stores/use-team-jobs-store';
import useTrajectoryPreview from '@/modules/trajectory/hooks/trajectory/use-trajectory-preview';
import Container from '@/shared/presentation/components/Container';
import SimulationCardFooter from '../../atoms/SimulationCardFooter';
import SimulationCardHeader from '../../atoms/SimulationCardHeader';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import React, { useCallback, useRef } from 'react';
import { PiAtomThin } from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import './SimulationCard.css';

const CARD_DRAG_INTENT_DISTANCE = 8;
const INTERACTIVE_CARD_TARGET_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[data-popover-trigger]',
    '[data-interactive-card-control="true"]'
].join(', ');

const isCardInteractiveTarget = (target: EventTarget | null, currentTarget: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
        return false;
    }

    const interactiveElement = target.closest(INTERACTIVE_CARD_TARGET_SELECTOR);
    if (!interactiveElement) {
        return false;
    }

    return interactiveElement !== currentTarget;
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
    onSelect,
    onMoveToFolder,
    onDelete,
    disablePrimaryInteraction = false
}: SimulationCardProps) {
    const navigate = useNavigate();
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const didDragRef = useRef(false);
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

    const resetPointerIntent = useCallback(() => {
        pointerStartRef.current = null;
        didDragRef.current = false;
    }, []);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0) {
            resetPointerIntent();
            return;
        }

        pointerStartRef.current = {
            x: event.clientX,
            y: event.clientY
        };
        didDragRef.current = false;
    }, [resetPointerIntent]);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (!pointerStartRef.current) {
            return;
        }

        const distanceX = Math.abs(event.clientX - pointerStartRef.current.x);
        const distanceY = Math.abs(event.clientY - pointerStartRef.current.y);
        if (distanceX >= CARD_DRAG_INTENT_DISTANCE || distanceY >= CARD_DRAG_INTENT_DISTANCE) {
            didDragRef.current = true;
        }
    }, []);

    const handleClick = useCallback((event: React.MouseEvent) => {
        const isInteractiveTarget = isCardInteractiveTarget(event.target, event.currentTarget);
        const shouldSuppressClick = didDragRef.current;
        resetPointerIntent();

        if (isInteractiveTarget || shouldSuppressClick) {
            return;
        }

        if (event.metaKey || event.ctrlKey) {
            onSelect(trajectory._id);
            return;
        }

        navigate(canvasPath);
    }, [canvasPath, navigate, onSelect, resetPointerIntent, trajectory._id]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (isCardInteractiveTarget(event.target, event.currentTarget)) {
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

        navigate(canvasPath);
    }, [canvasPath, navigate, onSelect, trajectory._id]);

    return (
        <article
            className={containerClass}
            onClick={disablePrimaryInteraction ? undefined : handleClick}
            onKeyDown={disablePrimaryInteraction ? undefined : handleKeyDown}
            onPointerDown={disablePrimaryInteraction ? undefined : handlePointerDown}
            onPointerMove={disablePrimaryInteraction ? undefined : handlePointerMove}
            onPointerCancel={disablePrimaryInteraction ? undefined : resetPointerIntent}
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
