import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { Trajectory } from '@/modules/trajectory/domain/entities';

const useUpdateTrajectory = () => {
    const { updateTrajectoryUseCase } = useTrajectoryUseCases();
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
            const updated = await updateTrajectoryUseCase.execute({ id, data });
            patchTrajectory(id, updated);
        }catch{
            // Rollback
            setTrajectories(previousTrajectories);
            setTrajectory(previousTrajectory);
        }
    }, [updateTrajectoryUseCase, trajectories, trajectory, patchTrajectory, setTrajectories, setTrajectory]);

    return updateTrajectory;
};

export default useUpdateTrajectory;
