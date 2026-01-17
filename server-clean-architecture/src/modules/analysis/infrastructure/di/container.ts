import { container } from 'tsyringe';
import { ANALYSIS_TOKENS } from './AnalysisTokens';
import AnalysisRepository from '../persistence/mongo/repositories/AnalysisRepository';

export const registerAnalysisDependencies = () => {
    container.registerSingleton(ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository);
};
