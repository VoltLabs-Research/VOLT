import { registerAnalysisDependencies } from '../application/registry';
import { analysisRepository } from './repositories/AnalysisRepository';

export const registerAnalysisInfrastructure = (): void => {
    registerAnalysisDependencies({
        analysisRepository
    });
};
