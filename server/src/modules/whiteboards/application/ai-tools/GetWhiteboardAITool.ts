import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
