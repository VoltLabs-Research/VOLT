import type { AnalysisDispatchService } from '../../job-runtime/services';
import type { ReverseChannelCommandHandler } from '../services';

interface AnalysisHandlersDependencies {
    analysisDispatchService: AnalysisDispatchService;
}

export const createAnalysisHandlers = (deps: AnalysisHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'analysis.start',
        execute: async (payload) => {
            return { data: await deps.analysisDispatchService.startAnalysis(payload as never) };
        }
    }
];
