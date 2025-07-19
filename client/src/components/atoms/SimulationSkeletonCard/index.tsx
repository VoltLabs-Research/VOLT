import { Skeleton } from '@mui/material'; 
import './SimulationSkeletonCard.css';

const SimulationSkeletonCard = ({ n }) => {

    return (new Array(n).fill(0)).map((_, index) => (
        <div className='simulation-container' key={index}>
            <Skeleton variant='rounded' width='100%' height='100%' />
            <div className='simulation-caption-container'>
                <div className='simulation-caption-left-container'>
                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='60%' />
                    <Skeleton variant='text' sx={{ fontSize: '1rem' }} width='40%' />
                </div>
            </div>
        </div>
    ));
};

export default SimulationSkeletonCard;