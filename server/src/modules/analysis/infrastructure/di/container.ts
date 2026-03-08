import { ANALYSIS_TOKENS } from './AnalysisTokens';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisPluginDisplayNameService from '@modules/analysis/services/AnalysisPluginDisplayNameService';
import AnalysisTeamJobsQueryService from '@modules/analysis/services/AnalysisTeamJobsQueryService';
import { container } from 'tsyringe';

export const registerAnalysisDependencies = () => {
    container.registerSingleton(ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository);
    container.registerSingleton(ANALYSIS_TOKENS.AnalysisTeamJobsQueryService, AnalysisTeamJobsQueryService);
    container.registerSingleton(AnalysisPluginDisplayNameService);
};
