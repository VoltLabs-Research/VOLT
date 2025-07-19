import { useEffect } from 'react';
import { PiDotsThreeVerticalBold } from "react-icons/pi";
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material'; 
import { PiAtomThin } from 'react-icons/pi';
import DashboardContainer from '../../../components/atoms/DashboardContainer';
import SimpExampleCover from '../../../assets/images/simulation-example-cover.png';
import useTrajectoryStore from "../../../stores/trajectories";
import './Dashboard.css';

const DashboardPage = () => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const navigate = useNavigate();

    useEffect(() => {
        getTrajectories();
    }, []);

    return (
        <DashboardContainer pageName='Dashboard'>
            <div className='trajectories-container'>
                {(isLoading) && (
                    (new Array(8).fill(0)).map((_, index) => (
                        <div className='simulation-container'>
                            <Skeleton key={index} variant='rounded' width='100%' height='100%' />
                            <div className='simulation-caption-container'>
                                <div className='simulation-caption-left-container'>
                                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='60%' />
                                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='40%' />
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {trajectories.map((trajectory) => (
                    <figure 
                        className='simulation-container' 
                        key={trajectory._id} 
                        onClick={() => navigate(`/canvas/${trajectory._id}/`)}
                    >
                        <div className='simulation-cover-container'>
                            {true ? (
                                <i className='simulation-cover-icon-container'>
                                    <PiAtomThin />
                                </i>
                            ) : (
                                <img className='simulation-image' src={SimpExampleCover} />
                            )}
                        </div>
                        <figcaption className='simulation-caption-container'>
                            <div className='simulation-caption-left-container'>
                                <h3 className='simulation-caption-title'>FCC Test Simulation</h3>
                                <p className='simulation-last-edited'>Edited 6 hours ago</p>
                            </div>
                            <i className='simulation-options-icon-container'>
                                <PiDotsThreeVerticalBold />
                            </i>
                        </figcaption>
                    </figure>
                ))}
            </div>
        </DashboardContainer>
    );
};

export default DashboardPage;