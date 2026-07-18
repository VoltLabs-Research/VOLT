import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetAnalysisAITool extends AITool {
    readonly name = 'get_analysis';
    readonly description = 'Get detailed information about a specific analysis.';
    readonly parameters = z.object({ analysisId: z.string() });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getAnalysisById({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });
        return { summary: `Retrieved analysis ${params.analysisId}.`, data: value };
    }
}
