import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetAnalysisFrameLogAITool extends AITool {
    readonly name = 'get_analysis_frame_log';
    readonly description = 'Get the execution log for a specific analysis frame.';
    readonly parameters = z.object({
        analysisId: z.string(),
        timestep: z.number(),
        afterCursor: z.string().optional()
    });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.getAnalysisFrameLog({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            timestep: params.timestep,
            afterCursor: params.afterCursor
        });
    }
}
