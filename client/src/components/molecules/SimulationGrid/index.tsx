/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
**/

import SimulationCard from '@/components/atoms/SimulationCard';
import SimulationSkeletonCard from '@/components/atoms/SimulationSkeletonCard';
import useTrajectoryStore from '@/stores/trajectories';
import useTeamStore from '@/stores/team';
import useAnimationPresence from '@/hooks/useAnimationPresence';
import './SimulationGrid.css';

const SimulationGrid = () => {
    const [parent] = useAnimationPresence();

    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const isLoadingTeams = useTeamStore((state) => state.isLoading);
    const uploadingFileCount = useTrajectoryStore((state) => state.uploadingFileCount);

    const showSkeleton = isLoading || isLoadingTeams || uploadingFileCount > 0;
    const skeletonCount = uploadingFileCount > 0 ? uploadingFileCount : 8;

    return (
        <div className='trajectories-container' ref={parent}>
        {showSkeleton && (
            <SimulationSkeletonCard n={skeletonCount} />
        )}

        {trajectories.map((trajectory) => (
            <SimulationCard key={trajectory._id} trajectory={trajectory} />
        ))}
        </div>
    );
};

export default SimulationGrid;