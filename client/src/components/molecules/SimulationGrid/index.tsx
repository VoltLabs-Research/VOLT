import { useEffect } from 'react';
import SimulationCard from '@/components/atoms/SimulationCard';
import SimulationSkeletonCard from '@/components/atoms/SimulationSkeletonCard';
import useTrajectoryStore from '@/stores/trajectories';
import useAnimationPresence from '@/hooks/ui/animation/use-animation-presence';
import useTeamJobsStore from '@/stores/team/jobs';
import './SimulationGrid.css';
import type { Job } from '@/types/jobs';

const SimulationGrid = () => {
    const [parent] = useAnimationPresence();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedTrajectories = useTrajectoryStore((state) => state.selectedTrajectories);
    const deleteSelectedTrajectories = useTrajectoryStore((state) => state.deleteSelectedTrajectories);
    const toggleTrajectorySelection = useTrajectoryStore((state) => state.toggleTrajectorySelection);
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
        <div className='trajectories-container' ref={parent as React.MutableRefObject<HTMLDivElement | null>}>
            {(isLoading || uploadingFileCount > 0) && (
                <SimulationSkeletonCard n={uploadingFileCount > 0 ? uploadingFileCount : 8} />
            )}

            {trajectories.map((trajectory) => (
                <SimulationCard 
                    key={trajectory._id} 
                    jobs={(Object.values(getJobsForTrajectory(trajectory._id) || {})
                        .filter((v) => Array.isArray(v))
                        .flat() as Job[])}
                    trajectory={trajectory}
                    isSelected={selectedTrajectories.includes(trajectory._id)}
                    onSelect={(id) => toggleTrajectorySelection(id)}
                />
            ))}
        </div>
    );
};

export default SimulationGrid;