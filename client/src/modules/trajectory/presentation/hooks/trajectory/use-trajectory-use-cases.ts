import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type DeleteTrajectoryUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryUseCase';

const useTrajectoryUseCases = createUseCasesHook({
    deleteTrajectoryUseCase: TRAJECTORY_TOKENS.DeleteTrajectoryUseCase,
    trajectoryRepository: TRAJECTORY_TOKENS.TrajectoryRepository
}) as () => {
    deleteTrajectoryUseCase: DeleteTrajectoryUseCase;
    trajectoryRepository: ITrajectoryRepository;
};

export default useTrajectoryUseCases;
