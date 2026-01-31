import { useRef, useCallback } from 'react';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from '../trajectory/use-trajectory-use-cases';
import { Trajectory } from '@/modules/trajectory/domain/entities';

interface TrajectoryUpdatePayload{
    trajectoryId: string;
    updates: Partial<Trajectory>;
    updatedAt?: string;
};

const useTrajectoryUpdates = (): void => {
    const patchTrajectory = useTrajectoryStore((state) => state.patchTrajectory);
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);
    const { getTrajectoryByIdUseCase } = useTrajectoryUseCases();
    const refetchingRef = useRef<Set<string>>(new Set());

    const fetchTrajectory = useCallback(async (trajectoryId: string) => {
        const result = await getTrajectoryByIdUseCase.execute(trajectoryId);
        setTrajectory(result);
    }, [getTrajectoryByIdUseCase, setTrajectory]);

    useSocketEvent<TrajectoryUpdatePayload>('trajectory.updated', (data) => {
        const { trajectoryId, updates } = data;

        patchTrajectory(trajectoryId, updates);

        // Re-fetch 
        if(updates.status === 'completed' && !refetchingRef.current.has(trajectoryId)){
            refetchingRef.current.add(trajectoryId);
            fetchTrajectory(trajectoryId).finally(() => {
                refetchingRef.current.delete(trajectoryId);
            });
        }
    });
};

export default useTrajectoryUpdates;
