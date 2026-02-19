import { useMemo } from 'react';
import { container } from 'tsyringe';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';
import type GetAnalysesUseCase from '../../application/use-cases/GetAnalysesUseCase';
import type GetAnalysesByTrajectoryUseCase from '../../application/use-cases/GetAnalysesByTrajectoryUseCase';
import type DeleteAnalysisUseCase from '../../application/use-cases/DeleteAnalysisUseCase';
import type RetryFailedFramesUseCase from '../../application/use-cases/RetryFailedFramesUseCase';

const useAnalysisUseCases = () => {
    return useMemo(() => ({
        getAnalysesUseCase: container.resolve<GetAnalysesUseCase>(ANALYSIS_TOKENS.GetAnalysesUseCase),
        getAnalysesByTrajectoryUseCase: container.resolve<GetAnalysesByTrajectoryUseCase>(ANALYSIS_TOKENS.GetAnalysesByTrajectoryUseCase),
        deleteAnalysisUseCase: container.resolve<DeleteAnalysisUseCase>(ANALYSIS_TOKENS.DeleteAnalysisUseCase),
        retryFailedFramesUseCase: container.resolve<RetryFailedFramesUseCase>(ANALYSIS_TOKENS.RetryFailedFramesUseCase)
    }), []);
};

export default useAnalysisUseCases;
