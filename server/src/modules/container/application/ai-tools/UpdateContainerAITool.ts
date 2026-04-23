import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class UpdateContainerAITool extends AITool {
    readonly name = 'update_container';
    readonly description = 'Update a Docker container.';
    readonly parameters = z.object({
        containerId: z.string(),
        name: z.string().optional(),
        reason: z.string().optional()
    });

    constructor(
        
        protected readonly useCase: UpdateContainerUseCase
    ) {
        super();
    }
};
