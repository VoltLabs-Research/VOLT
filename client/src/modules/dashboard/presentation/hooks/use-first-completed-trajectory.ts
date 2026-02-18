import { useState, useEffect } from 'react';
import useGetTrajectories from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectories';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import type { Trajectory } from '@/modules/trajectory/domain/entities';

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
            } catch {
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
