import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateWhiteboardAITool extends AITool {
    readonly name = 'update_whiteboard';
    readonly description = 'Update a whiteboard.';
    readonly parameters = z.object({
        whiteboardId: z.string(),
        title: z.string().optional()
    });

    constructor(
        protected readonly useCase: UpdateWhiteboardUseCase
    ) {
        super();
    }
}
