import { useMemo } from 'react';
import { container } from 'tsyringe';
import type ClearHistoryUseCase from '../../../application/use-cases/jobs/ClearHistoryUseCase';
import type RemoveRunningJobsUseCase from '../../../application/use-cases/jobs/RemoveRunningJobsUseCase';
import type RetryFailedJobsUseCase from '../../../application/use-cases/jobs/RetryFailedJobsUseCase';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

const useTrajectoryJobsUseCases = () => {
    return useMemo(() => ({
        clearHistoryUseCase: container.resolve<ClearHistoryUseCase>(TRAJECTORY_TOKENS.ClearHistoryUseCase),
        removeRunningJobsUseCase: container.resolve<RemoveRunningJobsUseCase>(TRAJECTORY_TOKENS.RemoveRunningJobsUseCase),
        retryFailedJobsUseCase: container.resolve<RetryFailedJobsUseCase>(TRAJECTORY_TOKENS.RetryFailedJobsUseCase)
    }), []);
};

export default useTrajectoryJobsUseCases;
