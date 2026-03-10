import { ANALYSIS_TOKENS } from './AnalysisTokens';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisPluginDisplayNameService from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import AnalysisTeamJobsQueryService from '@modules/analysis/infrastructure/services/AnalysisTeamJobsQueryService';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerAnalysisDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository],
            [ANALYSIS_TOKENS.AnalysisTeamJobsQueryService, AnalysisTeamJobsQueryService],
            AnalysisPluginDisplayNameService
        ]
    });
};
