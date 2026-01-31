import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/tokens';
import type GetAnalysesUseCase from '../../application/use-cases/GetAnalysesUseCase';
import type GetAnalysesByTrajectoryUseCase from '../../application/use-cases/GetAnalysesByTrajectoryUseCase';
import type DeleteAnalysisUseCase from '../../application/use-cases/DeleteAnalysisUseCase';
import type RetryFailedFramesUseCase from '../../application/use-cases/RetryFailedFramesUseCase';

const useAnalysisUseCases = createUseCasesHook({
    getAnalysesUseCase: ANALYSIS_TOKENS.GetAnalysesUseCase,
    getAnalysesByTrajectoryUseCase: ANALYSIS_TOKENS.GetAnalysesByTrajectoryUseCase,
    deleteAnalysisUseCase: ANALYSIS_TOKENS.DeleteAnalysisUseCase,
    retryFailedFramesUseCase: ANALYSIS_TOKENS.RetryFailedFramesUseCase
}) as () => {
    getAnalysesUseCase: GetAnalysesUseCase;
    getAnalysesByTrajectoryUseCase: GetAnalysesByTrajectoryUseCase;
    deleteAnalysisUseCase: DeleteAnalysisUseCase;
    retryFailedFramesUseCase: RetryFailedFramesUseCase;
};

export default useAnalysisUseCases;
