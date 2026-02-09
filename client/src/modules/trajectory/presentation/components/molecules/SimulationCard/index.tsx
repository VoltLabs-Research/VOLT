import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin } from 'react-icons/pi';
import { Trajectory } from '@/modules/trajectory/domain/entities';
import { getStageMessage, isProcessingStatus } from '../../../../domain/constants';
import useTrajectoryPreview from '../../../hooks/trajectory/use-trajectory-preview';
import SimulationCardHeader from '../../atoms/SimulationCardHeader';
import SimulationCardFooter from '../../atoms/SimulationCardFooter';
import SimulationCardUsers from '../../atoms/SimulationCardUsers';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils';
import './SimulationCard.css';

interface SimulationCardProps{
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (id: string) => void;
};

const SimulationCard = ({ trajectory, isSelected, onSelect }: SimulationCardProps) => {
    const navigate = useNavigate();

    const { previewBlobUrl, isLoading: previewLoading, error: previewError, retry: retryPreview } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        version: trajectory.updatedAt,
        enabled: trajectory.status === 'completed'
    });

    const isProcessing = isProcessingStatus(trajectory.status);
    const processingMessage = getStageMessage(trajectory.status);

    const containerClass = cn(
        'simulation-card cursor-pointer radius-md b-soft p-relative',
        isProcessing && 'has-jobs',
        isSelected && 'is-selected'
    );

    const handleClick = useCallback((e: React.MouseEvent) => {
        if(e.metaKey || e.ctrlKey){
            onSelect(trajectory._id);
        }else{
            navigate(`/canvas/${trajectory._id}/`);
        }
    }, [navigate, onSelect, trajectory._id]);

    const showPreview = previewBlobUrl && !previewError;
    const showPlaceholder = !showPreview || previewLoading;

    return (
        <Container className={containerClass} onClick={handleClick}>
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
                        onError={() => retryPreview()}
                    />
                )}
            </Container>

            <SimulationCardHeader 
                user={typeof trajectory.createdBy === 'object' ? trajectory.createdBy : null} 
            />

            <SimulationCardFooter
                trajectoryId={trajectory._id}
                name={trajectory.name}
                updatedAt={trajectory.updatedAt}
                isProcessing={isProcessing}
                processingMessage={processingMessage}
            />

            <SimulationCardUsers trajectoryId={trajectory._id} />
        </Container>
    );
};

export default SimulationCard;
