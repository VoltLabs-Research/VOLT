import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PiAtomThin, PiLineSegmentsLight, PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import SimpExampleCover from '@/assets/images/simulation-example-cover.png';
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
        if (isCompleted) return 'completed';
        if (completionRate === 0 && hasActiveJobs) return 'starting...';
        return 'processing';
    };

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
                    {true ? (
                        <i className='simulation-cover-icon-container'>
                            <PiAtomThin />
                        </i>
                    ) : (
                        <img 
                            className='simulation-image' 
                            src={SimpExampleCover} 
                            alt="Simulation cover" 
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