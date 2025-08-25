import { useEffect } from 'react';
import SimulationCard from '@/components/atoms/SimulationCard';
import SimulationSkeletonCard from '@/components/atoms/SimulationSkeletonCard';
import useTrajectoryStore from '@/stores/trajectories';
import useAnimationPresence from '@/hooks/ui/animation/use-animation-presence';
import useTeamJobsStore from '@/stores/team/jobs';
import './SimulationGrid.css';

const SimulationGrid = () => {
    const [parent] = useAnimationPresence();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedTrajectories = useTrajectoryStore((state) => state.selectedTrajectories);
    const deleteSelectedTrajectories = useTrajectoryStore((state) => state.deleteSelectedTrajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoadingTrajectories);
    const uploadingFileCount = useTrajectoryStore((state) => state.uploadingFileCount);
    const getJobsForTrajectory = useTeamJobsStore((state) => state.getJobsForTrajectory);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if(selectedTrajectories.length === 0){
                return;
            }

            const isDeleteShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Backspace';
            if(isDeleteShortcut){
                event.preventDefault();
                deleteSelectedTrajectories();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div className='trajectories-container' ref={parent}>
            {(isLoading || uploadingFileCount > 0) && (
                <SimulationSkeletonCard n={uploadingFileCount > 0 ? uploadingFileCount : 8} />
            )}

            {trajectories.map((trajectory) => (
                <SimulationCard 
                    key={trajectory._id} 
                    jobs={getJobsForTrajectory(trajectory._id)}
                    trajectory={trajectory}
                    isSelected={selectedTrajectories.includes(trajectory._id)}
                />
            ))}
        </div>
    );
};

export default SimulationGrid;