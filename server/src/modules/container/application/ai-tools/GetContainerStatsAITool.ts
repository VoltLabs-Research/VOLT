import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetContainerStatsAITool extends AITool {
    readonly name = 'get_container_stats';
    readonly description = 'Get resource usage stats for a container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        
        protected readonly useCase: GetContainerStatsUseCase
    ) {
        super();
    }
};
