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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiLineSegmentsLight, PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import { api } from '@/services/api';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import ActionBasedFloatingContainer from '@/components/atoms/ActionBasedFloatingContainer';
import ProgressBadge from '@/components/atoms/ProgressBadge';
import ProgressBorderContainer from '@/components/atoms/ProgressBorderContainer';
import useTrajectoryStore from '@/stores/trajectories';
import useJobProgress from '@/hooks/useJobProgress';
import useCardInteractions from '@/hooks/useCardInteractions';
import './SimulationCard.css';

interface JobStats {
    total: number;
    completionRate: number;
    hasActiveJobs: boolean;
}

interface Jobs {
    _stats?: JobStats;
}

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
    jobs?: Jobs;
}

const SimulationCard: React.FC<SimulationCardProps> = ({ 
    trajectory, 
    isSelected, 
    onSelect, 
    jobs = {} 
}) => {
    const navigate = useNavigate();
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    const dislocationAnalysis = useTrajectoryStore((state) => state.dislocationAnalysis);
    
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(false);
    const [lastPreviewId, setLastPreviewId] = useState<string | null>(null);

    const jobProgress = useJobProgress(jobs, trajectory._id);
    const {
        totalJobs,
        completionRate,
        hasJobs,
        hasActiveJobs,
        isCompleted,
        shouldHideBorder,
        getBorderColor,
        getProgressBorder,
        cleanup
    } = jobProgress;

    const { isDeleting, handleClick, handleDelete } = useCardInteractions(
        onSelect,
        (id: string) => navigate(`/canvas/${id}/`),
        hasJobs
    );

    useEffect(() => {
        const loadPreview = async () => {
            if(!trajectory.preview){
                setPreviewBlobUrl(null);
                setLastPreviewId(null);
                return;
            }

            if(trajectory.preview === lastPreviewId){
                console.log('Preview ID unchanged, skipping reload:', trajectory.preview);
                return;
            }

            try{
                setPreviewLoading(true);
                setPreviewError(false);

                console.log('Loading preview for trajectory:', trajectory._id, 'previewId:', trajectory.preview);

                if(previewBlobUrl){
                    URL.revokeObjectURL(previewBlobUrl);
                    setPreviewBlobUrl(null);
                }

                // Cache busting with timestamp + previewId
                const cacheBuster = `t=${Date.now()}&pid=${trajectory.preview}&updated=${new Date(trajectory.updatedAt).getTime()}`;
                
                const response = await api.get(`/trajectories/${trajectory._id}/preview?${cacheBuster}`, {
                    responseType: 'blob',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });

                const blobUrl = URL.createObjectURL(response.data);
                setPreviewBlobUrl(blobUrl);
                setLastPreviewId(trajectory.preview);
                
                console.log('Preview loaded successfully:', blobUrl);
            }catch(error){
                console.error('Error loading preview:', error);
                setPreviewError(true);
                setPreviewBlobUrl(null);
                setLastPreviewId(null);
            }finally{
                setPreviewLoading(false);
            }
        };

        loadPreview();

        return () => {
            if(previewBlobUrl){
                URL.revokeObjectURL(previewBlobUrl);
            }
        };
    }, [trajectory._id, trajectory.preview, trajectory.updatedAt]);

    const containerClasses = `simulation-container ${hasActiveJobs ? 'has-jobs' : ''} ${isDeleting ? 'is-deleting' : ''} ${isSelected ? 'is-selected' : ''}`;

    const onDelete = (): void => {
        handleDelete(trajectory._id, deleteTrajectoryById, cleanup);
    };

    const handleViewScene = (): void => {
        navigate(`/canvas/${trajectory._id}/`);
    };

    const handleShare = (): void => {
    };

    const handleDislocationAnalysis = (): void => {
        dislocationAnalysis(trajectory._id);
    };

    const getJobStatusText = (): string => {
        if(isCompleted) return 'completed';
        if(completionRate === 0 && hasActiveJobs) return 'starting...';
        return 'processing';
    };

    const shouldShowPreview = previewBlobUrl && !previewError;
    const shouldShowPlaceholder = !shouldShowPreview || previewLoading;

    return (
        <figure 
            className={containerClasses} 
            onClick={(e) => handleClick(e, trajectory._id)}
        >
            <ProgressBorderContainer
                progressBorder={getProgressBorder()}
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
    );
};

export default SimulationCard;