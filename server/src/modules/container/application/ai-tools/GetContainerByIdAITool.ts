import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetContainerByIdAITool extends AITool {
    readonly name = 'get_container_by_id';
    readonly description = 'Get detailed information about a specific container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        
        protected readonly useCase: GetContainerByIdUseCase
    ) {
        super();
    }
};
