import { useState, useEffect } from 'react';
import useGetTrajectories from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectories';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';

interface UseFirstCompletedTrajectoryReturn {
    completedTrajectory: Trajectory | null;
    isLoadingTrajectories: boolean;
}

const useFirstCompletedTrajectory = (): UseFirstCompletedTrajectoryReturn => {
    const selectedTeam = useSelectedTeam();
    const getTrajectories = useGetTrajectories();
    const [completedTrajectory, setCompletedTrajectory] = useState<Trajectory | null>(null);
    const [isLoadingTrajectories, setIsLoadingTrajectories] = useState(true);

    useEffect(() => {
        if (!selectedTeam?._id) return;
        const fetchFirstCompleted = async () => {
            setIsLoadingTrajectories(true);
            try {
                const result = await getTrajectories({ page: 1, limit: 10 });
                setCompletedTrajectory(result.data.find((t: Trajectory) => t.status === 'completed') || null);
            } catch(error: unknown) {
                if(ApiError.isRBACError(error)){
                    const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                    sileo.error({ title: msg });
                }
                setCompletedTrajectory(null);
            } finally {
                setIsLoadingTrajectories(false);
            }
        };
        fetchFirstCompleted();
    }, [selectedTeam?._id]);

    return { completedTrajectory, isLoadingTrajectories };
};

export default useFirstCompletedTrajectory;
