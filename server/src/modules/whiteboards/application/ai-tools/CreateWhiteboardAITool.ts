import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CreateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class CreateWhiteboardAITool extends AITool {
    readonly name = 'create_whiteboard';
    readonly description = 'Create a new whiteboard.';
    readonly parameters = z.object({
        title: z.string(),
        folderId: z.string().nullable().optional()
    });

    constructor(
        protected readonly useCase: CreateWhiteboardUseCase
    ) {
        super();
    }
}
