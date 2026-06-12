import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetWhiteboardAITool extends AITool {
    readonly name = 'get_whiteboard';
    readonly description = 'Get detailed information about a specific whiteboard.';
    readonly parameters = z.object({ whiteboardId: z.string() });

    constructor(
        protected readonly useCase: GetWhiteboardUseCase
    ) {
        super();
    }
}
