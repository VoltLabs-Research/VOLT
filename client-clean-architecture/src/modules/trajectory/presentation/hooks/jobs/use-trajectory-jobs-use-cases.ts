import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ClearHistoryUseCase from '../../../application/use-cases/jobs/ClearHistoryUseCase';
import type RemoveRunningJobsUseCase from '../../../application/use-cases/jobs/RemoveRunningJobsUseCase';
import type RetryFailedJobsUseCase from '../../../application/use-cases/jobs/RetryFailedJobsUseCase';

const useTrajectoryJobsUseCases = createUseCasesHook({
    clearHistoryUseCase: TRAJECTORY_TOKENS.ClearHistoryUseCase,
    removeRunningJobsUseCase: TRAJECTORY_TOKENS.RemoveRunningJobsUseCase,
    retryFailedJobsUseCase: TRAJECTORY_TOKENS.RetryFailedJobsUseCase
}) as () => {
    clearHistoryUseCase: ClearHistoryUseCase;
    removeRunningJobsUseCase: RemoveRunningJobsUseCase;
    retryFailedJobsUseCase: RetryFailedJobsUseCase;
};

export default useTrajectoryJobsUseCases;
