import { container } from 'tsyringe';
import type IAnalysisRepository from '../../domain/ports/IAnalysisRepository';
import AnalysisRepository from '../repositories/AnalysisRepository';
import {
    GetAnalysesUseCase,
    GetAnalysesByTrajectoryUseCase,
    DeleteAnalysisUseCase,
    RetryFailedFramesUseCase
} from '../../application/use-cases';
import { ANALYSIS_TOKENS } from './tokens';

export const ensureAnalysisDI = (): void => {
    container.register<IAnalysisRepository>(ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository);
    container.register(ANALYSIS_TOKENS.GetAnalysesUseCase, GetAnalysesUseCase);
    container.register(ANALYSIS_TOKENS.GetAnalysesByTrajectoryUseCase, GetAnalysesByTrajectoryUseCase);
    container.register(ANALYSIS_TOKENS.DeleteAnalysisUseCase, DeleteAnalysisUseCase);
    container.register(ANALYSIS_TOKENS.RetryFailedFramesUseCase, RetryFailedFramesUseCase);
};
