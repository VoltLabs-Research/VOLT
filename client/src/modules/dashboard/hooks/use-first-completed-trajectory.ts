import { useMemo } from 'react';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface UseFirstCompletedTrajectoryReturn {
    completedTrajectory: Trajectory | null;
    isLoadingTrajectories: boolean;
};

const useFirstCompletedTrajectory = (): UseFirstCompletedTrajectoryReturn => {
    const selectedTeam = useSelectedTeam();

    const trajectoriesQuery = useTrajectoriesQuery(
        {
            page: 1,
            limit: 10
        },
        { enabled: !!selectedTeam?._id }
    );

    const completedTrajectory = useMemo((): Trajectory | null => {
        if (!trajectoriesQuery.data) {
            return null;
        }

        return trajectoriesQuery.data.data.find(
            (trajectory: Trajectory) => trajectory.status === 'completed'
        ) || null;
    }, [trajectoriesQuery.data]);

    return {
        completedTrajectory,
        isLoadingTrajectories: trajectoriesQuery.isLoading
    };
};

export default useFirstCompletedTrajectory;
