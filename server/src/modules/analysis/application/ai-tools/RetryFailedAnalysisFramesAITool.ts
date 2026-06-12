import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import RetryFailedFramesUseCase from '@modules/analysis/application/use-cases/RetryFailedFramesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RetryFailedAnalysisFramesAITool extends AITool {
    readonly name = 'retry_failed_analysis_frames';
    readonly description = 'Retry the failed frames of an analysis.';
    readonly parameters = z.object({ analysisId: z.string() });

    constructor(
        protected readonly useCase: RetryFailedFramesUseCase
    ) {
        super();
    }
}
