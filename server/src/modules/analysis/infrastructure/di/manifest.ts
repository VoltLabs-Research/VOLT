import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import AnalysisLogSocketModule from '@modules/analysis/infrastructure/socket/AnalysisLogSocketModule';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const analysisDIManifest: ModuleManifest = {
    name: 'analysis',
    singletons: [
        [ANALYSIS_TOKENS.AnalysisRepository, AnalysisRepository],
        [ANALYSIS_TOKENS.AnalysisExecutionLogService, AnalysisExecutionLogService],
        [ANALYSIS_TOKENS.AnalysisLogSocketModule, AnalysisLogSocketModule],
        GetAnalysisFrameLogUseCase
    ],
    aliases: [
        [SOCKET_TOKENS.SocketModule, ANALYSIS_TOKENS.AnalysisLogSocketModule]
    ]
};
