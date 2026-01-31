import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';

const useDeleteTrajectory = () => {
    const { deleteTrajectoryUseCase } = useTrajectoryUseCases();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const removeTrajectory = useTrajectoryStore((state) => state.removeTrajectory);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);

    const deleteTrajectory = useCallback(async (id: string) => {
        const previousTrajectories = trajectories;

        // Optimistic delete
        removeTrajectory(id);

        try{
            await deleteTrajectoryUseCase.execute({ id });
        }catch{
            // Rollback
            setTrajectories(previousTrajectories);
        }
    }, [deleteTrajectoryUseCase, trajectories, removeTrajectory, setTrajectories]);

    return deleteTrajectory;
};

export default useDeleteTrajectory;
