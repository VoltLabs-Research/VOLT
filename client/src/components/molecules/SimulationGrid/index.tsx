import { useEffect } from 'react';
import SimulationCard from '../../atoms/SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/trajectories';
import './SimulationGrid.css';

const SimulationGrid = () => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);

    useEffect(() => {
        if(!trajectories.length){
            getTrajectories();
        }
    }, []);

    return (
        <div className='trajectories-container'>
            {(isLoading) && (
                <SimulationSkeletonCard n={8} />
            )}

            {trajectories.map((trajectory) => (
                <SimulationCard trajectory={trajectory} />
            ))}
        </div>
    );
};

export default SimulationGrid;