import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteAnalysisAITool extends AITool {
    readonly name = 'delete_analysis';
    readonly description = 'Delete an analysis.';
    readonly parameters = z.object({ analysisId: z.string(), reason: z.string().optional() });

    constructor(
        protected readonly useCase: DeleteAnalysisByIdUseCase
    ) {
        super();
    }
}
