import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-services';

const useDeleteTrajectory = () => {
    const { deleteTrajectoryUseCase } = useTrajectoryUseCases();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const removeTrajectory = useTrajectoryStore((state) => state.removeTrajectory);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);

    return useCallback(async (id: string) => {
        const previousItems = trajectories;
        removeTrajectory(id);
        try {
            await deleteTrajectoryUseCase.execute({ id });
        } catch (error) {
            setTrajectories(previousItems);
            throw error;
        }
    }, [deleteTrajectoryUseCase, trajectories, removeTrajectory, setTrajectories]);
};

export default useDeleteTrajectory;
