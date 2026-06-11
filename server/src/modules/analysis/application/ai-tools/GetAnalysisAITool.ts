import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetAnalysisAITool extends AITool {
    readonly name = 'get_analysis';
    readonly description = 'Get detailed information about a specific analysis.';
    readonly parameters = z.object({ analysisId: z.string() });

    constructor(
        protected readonly useCase: GetAnalysisByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });
        if (!result.success) throw result.error;
        return { summary: `Retrieved analysis ${params.analysisId}.`, data: result.value };
    }
}
