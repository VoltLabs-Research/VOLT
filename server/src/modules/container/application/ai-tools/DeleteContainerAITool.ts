import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteContainerAITool extends AITool {
    readonly name = 'delete_container';
    readonly description = 'Delete a Docker container.';
    readonly parameters = z.object({ containerId: z.string(), reason: z.string().optional() });

    constructor(
        protected readonly useCase: DeleteContainerUseCase
    ) {
        super();
    }
}
