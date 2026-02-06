import { useMemo } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import { getStageMessage, isProcessingStatus } from '../../../domain/constants';

const useProcessingStatus = (trajectoryId: string) => {
    const trajectory = useTrajectoryStore((state) => 
        state.trajectories.find((trajectory) => trajectory._id === trajectoryId));

    return useMemo(() => {
        const status = trajectory?.status;
        return {
            status,
            isProcessing: isProcessingStatus(status),
            message: getStageMessage(status)
        };
    }, [trajectory?.status]);
};

export default useProcessingStatus;
