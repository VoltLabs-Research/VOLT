import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ITrajectoryRepository from '../../../domain/port/ITrajectoryRepository';
import type DeleteTrajectoryUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryUseCase';

const useTrajectoryUseCases = () => {
    return useMemo(() => ({
        deleteTrajectoryUseCase: container.resolve<DeleteTrajectoryUseCase>(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase),
        trajectoryRepository: container.resolve<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository)
    }), []);
};

export default useTrajectoryUseCases;
