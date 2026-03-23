import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTrajectoriesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { getFirstTrajectoryFrameWithBoxBounds } from '@/modules/fractal/utilities/frame-box-bounds';
import { useMemo } from 'react';
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
            limit: 25
        },
        { enabled: !!selectedTeam?._id }
    );

    const completedTrajectory = useMemo((): Trajectory | null => {
        if (!trajectoriesQuery.data) {
            return null;
        }

        const previewCandidates = trajectoriesQuery.data.data.filter((trajectory: Trajectory) => {
            return trajectory.status === 'completed'
                && Boolean(getFirstTrajectoryFrameWithBoxBounds(trajectory));
        });

        return previewCandidates.find((trajectory) => trajectory.hasPreview === true)
            ?? previewCandidates[0]
            ?? null;
    }, [trajectoriesQuery.data]);

    return {
        completedTrajectory,
        isLoadingTrajectories: trajectoriesQuery.isLoading
    };
};

export default useFirstCompletedTrajectory;
