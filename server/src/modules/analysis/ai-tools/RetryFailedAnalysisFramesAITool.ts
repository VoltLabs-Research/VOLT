import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class RetryFailedAnalysisFramesAITool extends AITool {
    readonly name = 'retry_failed_analysis_frames';
    readonly description = 'Retry the failed frames of an analysis.';
    readonly parameters = z.object({ analysisId: z.string() });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.retryFailedFrames({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            userId: scope.userId
        });
    }
}
