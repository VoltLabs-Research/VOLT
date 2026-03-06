import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ITrajectoryRepository from '../../../domain/port/ITrajectoryRepository';
import type DeleteTrajectoryUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryUseCase';

const useTrajectoryUseCases = () => {
    return {
        deleteTrajectoryUseCase: useResolve<DeleteTrajectoryUseCase>(TRAJECTORY_TOKENS.DeleteTrajectoryUseCase),
        trajectoryRepository: useResolve<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository)
    };
};

export default useTrajectoryUseCases;
