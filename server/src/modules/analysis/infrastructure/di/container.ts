import { ANALYSIS_TOKENS } from './AnalysisTokens';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import AnalysisLogSocketModule from '@modules/analysis/infrastructure/socket/AnalysisLogSocketModule';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisTeamJobsQueryService from '@modules/analysis/infrastructure/services/AnalysisTeamJobsQueryService';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerAnalysisDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository],
            [ANALYSIS_TOKENS.AnalysisTeamJobsQueryService, AnalysisTeamJobsQueryService],
            [ANALYSIS_TOKENS.AnalysisExecutionLogService, AnalysisExecutionLogService],
            [ANALYSIS_TOKENS.AnalysisLogSocketModule, AnalysisLogSocketModule],
            GetAnalysisFrameLogUseCase
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, ANALYSIS_TOKENS.AnalysisLogSocketModule]
        ]
    });
};
