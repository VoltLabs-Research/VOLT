import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteAnalysisAITool extends AITool {
    readonly name = 'delete_analysis';
    readonly description = 'Delete an analysis.';
    readonly parameters = z.object({ analysisId: z.string(), reason: z.string().optional() });

    #service = new AnalysisService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.deleteAnalysisById({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            userId: scope.userId
        });
    }
}
