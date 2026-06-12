import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';
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

    constructor(
        protected readonly useCase: GetAnalysisFrameLogUseCase
    ) {
        super();
    }
}
