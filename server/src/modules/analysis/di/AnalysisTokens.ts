import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';

export const ANALYSIS_TOKENS = Object.freeze({
    AnalysisRepository: COMPUTE_TOKENS.AnalysisRepository,
    AnalysisExecutionLogService: COMPUTE_TOKENS.AnalysisExecutionLogService,
    AnalysisService: Symbol.for('AnalysisService')
});
