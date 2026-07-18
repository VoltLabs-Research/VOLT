import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/use-cases/DeleteWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteWhiteboardAITool extends AITool {
    readonly name = 'delete_whiteboard';
    readonly description = 'Delete a whiteboard.';
    readonly parameters = z.object({ whiteboardId: z.string() });

    constructor(
        protected readonly useCase: DeleteWhiteboardUseCase
    ) {
        super();
    }
}
