import { useEffect, useRef } from 'react';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useTeamStore } from '@/stores/slices/team';
import useLogger from '@/hooks/core/use-logger';

interface UseRequireTrajectoryOptions {
    trajectoryId?: string;
    enabled?: boolean;
}

const useRequireTrajectory = (options: UseRequireTrajectoryOptions) => {
    const { trajectoryId, enabled = true } = options;
    const logger = useLogger('use-require-trajectory');

    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const error = useTrajectoryStore((state) => state.error);

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const requestInFlightRef = useRef(false);

    useEffect(() => {
        // Don't run if disabled or missing trajectoryId
        if (!enabled || !trajectoryId || !selectedTeam) {
            return;
        }

        // Don't refetch if trajectory is already loaded
        if (trajectory?._id === trajectoryId) {
            logger.log(`Trajectory ${trajectoryId} already loaded`);
            return;
        }

        // Don't make duplicate requests if one is already in flight
        if (requestInFlightRef.current) {
            logger.log(`Request already in flight for trajectory ${trajectoryId}`);
            return;
        }

        // Mark request as in flight
        requestInFlightRef.current = true;

        logger.log(`Fetching trajectory: ${trajectoryId}`);

        getTrajectoryById(trajectoryId)
            .finally(() => {
                requestInFlightRef.current = false;
            });
    }, [trajectoryId, enabled, selectedTeam?._id, trajectory?._id, getTrajectoryById, logger]);

    return {
        trajectory,
        isLoading,
        error,
        isReady: !!trajectory && trajectory._id === trajectoryId && !isLoading
    };
};

export default useRequireTrajectory;
