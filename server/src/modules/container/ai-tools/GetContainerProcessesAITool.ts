import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { GetContainerProcessesUseCase } from '@modules/container/use-cases/GetContainerProcessesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetContainerProcessesAITool extends AITool {
    readonly name = 'get_container_processes';
    readonly description = 'List running processes in a container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        protected readonly useCase: GetContainerProcessesUseCase
    ) {
        super();
    }
}
