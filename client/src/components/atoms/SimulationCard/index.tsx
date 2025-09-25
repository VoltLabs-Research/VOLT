/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiLineSegmentsLight, PiDotsThreeVerticalBold, PiImagesSquareThin } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import formatTimeAgo from '@/utilities/formatTimeAgo';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import SystemNotification from '@/components/atoms/SystemNotification';
import ActionBasedFloatingContainer from '@/components/organisms/ActionBasedFloatingContainer';
import ProgressBadge from '@/components/atoms/animations/ProgressBadge';
import ProgressBorderContainer from '@/components/atoms/animations/ProgressBorderContainer';
import useTrajectoryStore from '@/stores/trajectories';
import useJobProgress from '@/hooks/jobs/use-job-progress';
import useCardInteractions from '@/hooks/ui/interaction/use-card-interaction';
import useTrajectoryPreview from '@/hooks/trajectory/use-trajectory-preview';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useModifiersStore from '@/stores/modifiers';
import useRasterStore from '@/stores/raster';
import type { Job } from '@/types/jobs';
import './SimulationCard.css';

interface Trajectory {
    _id: string;
    name?: string;
    updatedAt: string;
    createdAt: string;
    preview?: string | null;
}

interface SimulationCardProps {
    trajectory: Trajectory;
    isSelected: boolean;
    onSelect: (id: string) => void;
    jobs?: Job[];
}

const SimulationCard: React.FC<SimulationCardProps> = ({ 
    trajectory, 
    isSelected, 
    jobs = {} 
}) => {
    const navigate = useNavigate();
    const [showNotification, setShowNotification] = useState(false);
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    const dislocationAnalysis = useModifiersStore((state) => state.dislocationAnalysis);
    const toggleTrajectorySelection = useTrajectoryStore((state) => state.toggleTrajectorySelection);
    const rasterize = useRasterStore((state) => state.rasterize);

    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const canPerformCpuIntensiveTask = (): boolean => {
        const enabled = import.meta.env.VITE_CPU_INTENSIVE_TASKS === 'true';
        // For testing: always show notification and return false
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000); 
        return false;
    };

    const {
        previewBlobUrl,
        isLoading: previewLoading,
        error: previewError,
        cleanup: cleanupPreview,
        retry: retryPreview
    } = useTrajectoryPreview({
        trajectoryId: trajectory._id,
        previewId: trajectory.preview,
        updatedAt: trajectory.updatedAt,
        enabled: true
    })

    const jobProgress = useJobProgress(jobs, trajectory._id);
    const {
        totalJobs,
        completionRate,
        hasJobs,
        hasActiveJobs,
        isCompleted,
        shouldHideBorder,
        getBorderColor,
        // TODO: PROGRESS BORDE UNUSED
        getAnimatedProgressBorder,
        cleanup: cleanupJobs,
        isAnimating
    } = jobProgress;

    const { isDeleting, handleClick, handleDelete } = useCardInteractions(
        toggleTrajectorySelection,
        (id: string) => navigate(`/canvas/${id}/`),
        hasActiveJobs
    );

    const containerClasses = `simulation-container ${hasActiveJobs ? 'has-jobs' : ''} ${isDeleting ? 'is-deleting' : ''} ${isSelected ? 'is-selected' : ''}`;

    const onDelete = (): void => {
        handleDelete(trajectory._id, deleteTrajectoryById, () => {
            cleanupJobs();
            cleanupPreview();
        });
    };

    const handleViewScene = (): void => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleShare = (): void => {
    };

    const handleDislocationAnalysis = async (): Promise<void> => {
        if (!canPerformCpuIntensiveTask()) {
            return;
        }
        try {
            await dislocationAnalysis(trajectory._id, analysisConfig);
        } catch (error) {
            console.error('Dislocation analysis failed:', error);
            // El error ya fue manejado por el store, solo lo registramos
        }
    };

    const handleRasterize = useCallback(async () => {
        if (!canPerformCpuIntensiveTask()) {
            return;
        }
        try {
            await rasterize(trajectory._id);
        } catch (error) {
            console.error('Rasterize failed:', error);
            // El error ya fue manejado por el store, solo lo registramos
        }
    }, [trajectory._id, rasterize]);

    const getJobStatusText = (): string => {
        if(isCompleted) return 'completed';
        if(completionRate === 0 && hasActiveJobs) return 'starting...';
        return 'processing';
    };

    const shouldShowPreview = previewBlobUrl && !previewError;
    const shouldShowPlaceholder = !shouldShowPreview || previewLoading;

    return (
        <>
        <figure 
            className={containerClasses} 
            onClick={(e) => handleClick(e, trajectory._id)}
        >
            <ProgressBorderContainer
                isAnimating={isAnimating}
                hasJobs={hasJobs}
                shouldHideBorder={shouldHideBorder}
            >
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
                    
                    <ProgressBadge
                        completionRate={completionRate}
                        hasActiveJobs={hasActiveJobs}
                        isCompleted={isCompleted}
                        getBorderColor={getBorderColor}
                        shouldShow={hasJobs && !shouldHideBorder}
                    />
                </div>
                </ProgressBorderContainer>

                <figcaption className='simulation-caption-container'>
                    <div className='simulation-caption-left-container'>
                        <EditableTrajectoryName
                            trajectory={trajectory} 
                            className='simulation-caption-title' 
                        />
                        
                        <div className='simulation-caption-left-bottom-container'>
                            <p className='simulation-last-edited'>
                                Edited {formatTimeAgo(trajectory.updatedAt)}
                            </p>
                            
                            {hasJobs && !shouldHideBorder && (
                                <>
                                    <span>•</span>
                                    <p className='simulation-running-jobs'>
                                        {totalJobs} jobs {getJobStatusText()}
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
            {showNotification && <SystemNotification />}
        </>
    );
};

export default SimulationCard;