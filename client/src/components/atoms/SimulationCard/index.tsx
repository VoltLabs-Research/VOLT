/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*/

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiLineSegmentsLight, PiDotsThreeVerticalBold, PiImagesSquareThin } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import formatTimeAgo from '@/utilities/formatTimeAgo';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import ProcessingLoader from '@/components/atoms/ProcessingLoader';
import useTrajectoryStore from '@/stores/trajectories';
import useCardInteractions from '@/hooks/ui/interaction/use-card-interaction';
import useTrajectoryPreview from '@/hooks/trajectory/use-trajectory-preview';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useModifiersStore from '@/stores/modifiers';
import useRasterStore from '@/stores/raster';
import './SimulationCard.css';

interface Trajectory {
    _id: string;
    name?: string;
    updatedAt: string;
    createdAt: string;
    preview?: string | null;
    status?: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
}

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

type ProcessingStage = 'idle' | 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';

const getMessageForStage = (stage: ProcessingStage): string => {
    switch (stage) {
        case 'idle':
            return '';
        case 'queued':
            return 'Queued...';
        case 'processing':
            return 'Processing frames...';
        case 'rendering':
            return 'Rendering...';
        case 'completed':
            return 'Complete';
        default:
            return 'Processing...';
    }
};

const useTrajectoryProcessingStatus = ({ trajectoryId }: any) => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const traj = trajectories.find((t) => t._id == trajectoryId);
    const stage = (traj?.status || 'idle') as ProcessingStage;

    return { 
        isProcessing: traj?.status !== 'completed' && traj?.status !== undefined, 
        message: getMessageForStage(stage) 
    };
};

const SimulationCard: React.FC<SimulationCardProps> = ({ 
    trajectory, 
    isSelected
}) => {
    const navigate = useNavigate();
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    const dislocationAnalysis = useModifiersStore((state) => state.dislocationAnalysis);
    const toggleTrajectorySelection = useTrajectoryStore((state) => state.toggleTrajectorySelection);
    const rasterize = useRasterStore((state) => state.rasterize);

    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const {
        previewBlobUrl,
        isLoading: previewLoading,
        error: previewError,
        cleanup: cleanupPreview,
        retry: retryPreview
    } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        updatedAt: trajectory.updatedAt,
        enabled: trajectory.status === 'completed'
    });

    const processingStatus = useTrajectoryProcessingStatus({
        trajectoryId: trajectory._id
    });

    const { isDeleting, handleClick, handleDelete } = useCardInteractions(
        toggleTrajectorySelection,
        (id: string) => navigate(`/canvas/${id}/`),
        processingStatus.isProcessing
    );

    const containerClasses = `simulation-container ${processingStatus.isProcessing ? 'has-jobs' : ''} ${isDeleting ? 'is-deleting' : ''} ${isSelected ? 'is-selected' : ''}`;

    const onDelete = (): void => {
        handleDelete(trajectory._id, deleteTrajectoryById, () => {
            cleanupPreview();
        });
    };

    const handleViewScene = (): void => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleShare = (): void => {
    };

    const handleDislocationAnalysis = async (): Promise<void> => {
        try {
            await dislocationAnalysis(trajectory._id, analysisConfig);
        } catch (error) {
            console.error('Dislocation analysis failed:', error);
        }
    };

    const handleRasterize = useCallback(async () => {
        try {
            if (rasterize) {
                await rasterize(trajectory._id);
            }
        } catch (error) {
            console.error('Rasterize failed:', error);
        }
    }, [trajectory._id, rasterize]);

    const shouldShowPreview = previewBlobUrl && !previewError;
    const shouldShowPlaceholder = !shouldShowPreview || previewLoading;
    const showProcessingLoader = processingStatus.isProcessing;

    return (
        <>
        <figure 
            className={containerClasses} 
            onClick={(e) => handleClick(e, trajectory._id)}
        >
            <div className='container-content'>
                <div className='simulation-cover-container'>
                    {shouldShowPlaceholder && (
                        <i className='simulation-cover-icon-container'>
                            <PiAtomThin />
                        </i>
                    )}
                    
                    {shouldShowPreview && (
                        <img 
                            className='simulation-image' 
                            src={previewBlobUrl}
                            alt={`Preview of ${trajectory.name || 'Trajectory'}`}
                            key={`${trajectory._id}-${trajectory.preview}-${trajectory.updatedAt}`}
                            onError={() => {
                                retryPreview();
                            }}
                        />
                    )}
                    
                </div>
            </div>

            <figcaption className='simulation-caption-container'>
                <div className='simulation-caption-left-container'>
                    <EditableTrajectoryName
                        trajectory={trajectory} 
                        className='simulation-caption-title' 
                    />
                    
                    <div className='simulation-caption-left-bottom-container'>
                        {showProcessingLoader ? (
                            <ProcessingLoader
                                message={processingStatus.message}
                                completionRate={0}
                                isVisible={true}
                            />
                        ) : (
                            <>
                                <p className='simulation-last-edited'>
                                    Edited {formatTimeAgo(trajectory.updatedAt)}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <ActionBasedFloatingContainer
                    options={[
                        ['View Scene', HiOutlineViewfinderCircle, handleViewScene],
                        ['Rasterize', PiImagesSquareThin, handleRasterize],
                        ['Share with Team', CiShare1, handleShare],
                        ['Dislocation Analysis', PiLineSegmentsLight, handleDislocationAnalysis],
                        ['Delete', RxTrash, onDelete],
                    ]}
                >
                    <i className='simulation-options-icon-container'>
                        <PiDotsThreeVerticalBold />
                    </i>
                </ActionBasedFloatingContainer>
            </figcaption>
        </figure>
        </>
    );
};

export default SimulationCard;