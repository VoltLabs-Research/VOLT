import useResolve from '@/shared/presentation/hooks/use-resolve';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';
import type GetAnalysesUseCase from '../../application/use-cases/GetAnalysesUseCase';
import type GetAnalysesByTrajectoryUseCase from '../../application/use-cases/GetAnalysesByTrajectoryUseCase';
import type DeleteAnalysisUseCase from '../../application/use-cases/DeleteAnalysisUseCase';
import type RetryFailedFramesUseCase from '../../application/use-cases/RetryFailedFramesUseCase';

const useAnalysisUseCases = () => {
    return {
        getAnalysesUseCase: useResolve<GetAnalysesUseCase>(ANALYSIS_TOKENS.GetAnalysesUseCase),
        getAnalysesByTrajectoryUseCase: useResolve<GetAnalysesByTrajectoryUseCase>(ANALYSIS_TOKENS.GetAnalysesByTrajectoryUseCase),
        deleteAnalysisUseCase: useResolve<DeleteAnalysisUseCase>(ANALYSIS_TOKENS.DeleteAnalysisUseCase),
        retryFailedFramesUseCase: useResolve<RetryFailedFramesUseCase>(ANALYSIS_TOKENS.RetryFailedFramesUseCase)
    };
};

export default useAnalysisUseCases;
