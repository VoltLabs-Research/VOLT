export const ANALYSIS_TOKENS = {
    AnalysisRepository: Symbol('AnalysisRepository'),
    GetAnalysesUseCase: Symbol('GetAnalysesUseCase'),
    GetAnalysesByTrajectoryUseCase: Symbol('GetAnalysesByTrajectoryUseCase'),
    DeleteAnalysisUseCase: Symbol('DeleteAnalysisUseCase'),
    RetryFailedFramesUseCase: Symbol('RetryFailedFramesUseCase')
} as const;
