import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
