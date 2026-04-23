import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class CreateContainerAITool extends AITool {
    readonly name = 'create_container';
    readonly description = 'Create a new Docker container.';
    readonly parameters = z.object({
        name: z.string(),
        image: z.string(),
        tag: z.string().optional(),
        ports: z.array(z.object({
            container: z.number(),
            host: z.number()
        })).optional(),
        reason: z.string().optional()
    });

    constructor(
        
        protected readonly useCase: CreateContainerUseCase
    ) {
        super();
    }
};
