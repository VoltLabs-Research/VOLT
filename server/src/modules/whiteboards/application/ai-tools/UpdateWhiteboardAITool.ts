import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
