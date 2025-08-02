import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@mui/material';
import { PiAtomThin, PiLineSegmentsLight, PiDotsThreeVerticalBold } from 'react-icons/pi';
import { RxTrash } from "react-icons/rx";
import { CiShare1 } from "react-icons/ci";
import { HiOutlineViewfinderCircle } from "react-icons/hi2";
import SimpExampleCover from '@/assets/images/simulation-example-cover.png';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import EditableTrajectoryName from '@/components/atoms/EditableTrajectoryName';
import useTrajectoryStore from '@/stores/trajectories';
import ActionBasedFloatingContainer from '@/components/atoms/ActionBasedFloatingContainer';
import './SimulationCard.css';

const SimulationCard = ({ trajectory, isSelected, onSelect, jobs = {} }) => {
    const navigate = useNavigate();
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    const dislocationAnalysis = useTrajectoryStore((state) => state.dislocationAnalysis);

    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [shouldHideBorder, setShouldHideBorder] = useState(false); 
    
    const completionTimeoutRef = useRef(null); 
    const previousCompletionRate = useRef(0);

    const loadTrajectoryOnCanvas = () => {
        navigate(`/canvas/${trajectory._id}/`);
    };
    
    const handleClick = (event) => {
        if(event.target.closest('.simulation-options-icon-container') || 
           event.target.closest('.simulation-caption-title') ||
           event.target.closest('.action-based-floating-container-element-wrapper')){
            return;
        }

        if(event.ctrlKey || event.metaKey){
            event.preventDefault();
            onSelect(trajectory._id);
        }else{
            loadTrajectoryOnCanvas();
        }
    };

    const totalJobs = jobs._stats?.total || 0;
    const completionRate = jobs._stats?.completionRate || 0;
    const hasJobs = totalJobs > 0;

    // Color del borde basado en el progreso
    const getBorderColor = () => {
        if (!hasJobs || shouldHideBorder) return 'transparent';
        if (completionRate === 100) return '#22c55e';
        if (completionRate >= 75) return '#3b82f6'; 
        if (completionRate >= 50) return '#f59e0b';
        if (completionRate >= 25) return '#f97316'; 
        return '#dc2626';
    };

    const getProgressBorder = () => {
        if(!hasJobs || completionRate === 0 || shouldHideBorder) return 'none';
        const borderColor = getBorderColor();
        const degrees = (completionRate / 100) * 360;
        return `conic-gradient(from -90deg, ${borderColor} 0deg, ${borderColor} ${degrees}deg, transparent ${degrees}deg, transparent 360deg)`;
    };

    useEffect(() => {
        if(completionRate === 100 && previousCompletionRate.current !== 100 && hasJobs){
            console.log(`Trajectory ${trajectory._id} completed! Starting 5-second countdown...`);
            setIsCompleted(true);
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }
            
            completionTimeoutRef.current = setTimeout(() => {
                console.log(`Hiding progress border for trajectory ${trajectory._id}`);
                setShouldHideBorder(true);
                setIsCompleted(false);
            }, 5000);
        }else if(completionRate < 100 && previousCompletionRate.current === 100){
            console.log(`Trajectory ${trajectory._id} has new jobs, showing border again`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if(!hasJobs){
            setShouldHideBorder(false);
            setIsCompleted(false);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }
        
        previousCompletionRate.current = completionRate;
        
        return () => {
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }
        };
    }, [completionRate, hasJobs, trajectory._id]);

    useEffect(() => {
        if(hasJobs){
            console.log(`Trajectory ${trajectory._id}: ${completionRate}% complete (${totalJobs} jobs) | Completed: ${isCompleted} | Hidden: ${shouldHideBorder}`);
        }
    }, [trajectory._id, completionRate, totalJobs, hasJobs, isCompleted, shouldHideBorder]);

    const containerClasses = `simulation-container ${isDeleting ? 'is-deleting' : ''} ${isSelected ? 'is-selected' : ''}`;
    
    const handleDelete = () => {
        if(completionTimeoutRef.current){
            clearTimeout(completionTimeoutRef.current);
        }
        
        setIsDeleting(true);
        setTimeout(() => {
            deleteTrajectoryById(trajectory._id);
        }, 500);
    };

    return (
        <figure className={containerClasses} onClick={handleClick}>
            <div 
                className="progress-border-wrapper"
                style={{
                    background: getProgressBorder(),
                    padding: (hasJobs && !shouldHideBorder) ? '4px' : '0px',
                    borderRadius: '16px',
                    transition: 'all 0.5s ease'
                }}
            >
                <div 
                    className='simulation-cover-container'
                    style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: 'white' 
                    }}
                >
                    {true ? (
                        <i className='simulation-cover-icon-container'>
                            <PiAtomThin />
                        </i>
                    ) : (
                        <img className='simulation-image' src={SimpExampleCover} alt="Simulation cover" />
                    )}
                    
                    {hasJobs && !shouldHideBorder && (
                        <Badge
                            badgeContent={isCompleted ? '✓' : `${completionRate}%`}
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                '& .MuiBadge-badge': {
                                    backgroundColor: getBorderColor(),
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    minWidth: '28px',
                                    height: '20px',
                                    fontWeight: 600,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    transition: 'all 0.3s ease'
                                }
                            }}
                        >
                            <div />
                        </Badge>
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
                        <p className='simulation-last-edited'>
                            Edited {formatTimeAgo(trajectory.updatedAt)}
                        </p>
                        
                        {hasJobs && !shouldHideBorder && (
                            <>
                                <span>•</span>
                                <p className='simulation-running-jobs'>
                                    {totalJobs} jobs {isCompleted ? 'completed' : 'processing'}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <ActionBasedFloatingContainer
                    options={[
                        ['View Scene', HiOutlineViewfinderCircle, loadTrajectoryOnCanvas],
                        ['Share with Team', CiShare1, () => {}],
                        ['Dislocation Analysis', PiLineSegmentsLight, () => dislocationAnalysis(trajectory._id)],
                        ['Delete', RxTrash, handleDelete],
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