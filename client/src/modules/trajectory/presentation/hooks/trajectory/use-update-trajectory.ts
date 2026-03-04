import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { Trajectory } from '@/modules/trajectory/domain/entities';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';

const useUpdateTrajectory = () => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const patchTrajectory = useTrajectoryStore((state) => state.patchTrajectory);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);

    const updateTrajectory = useCallback(async (id: string, data: Partial<Trajectory>) => {
        const previousTrajectories = trajectories;
        const previousTrajectory = trajectory;

        // Optimistic update
        patchTrajectory(id, data);

        try{
            const updated = await trajectoryRepository.update(id, data);
            patchTrajectory(id, updated);
            sileo.success({ title: 'Trajectory updated' });
        }catch(error){
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to update this trajectory';
                sileo.error({ title: msg });
            }else{
                sileo.error({ title: 'Failed to update trajectory' });
            }
            setTrajectories(previousTrajectories);
            setTrajectory(previousTrajectory);
            throw error;
        }
    }, [trajectoryRepository, trajectories, trajectory, patchTrajectory, setTrajectories, setTrajectory]);

    return updateTrajectory;
};

export default useUpdateTrajectory;
