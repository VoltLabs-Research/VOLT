import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { GetContainerFilesUseCase } from '@modules/container/use-cases/GetContainerFilesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListContainerFilesAITool extends AITool {
    readonly name = 'list_container_files';
    readonly description = 'List files in a container directory.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string().optional().default('/') });

    constructor(
        protected readonly useCase: GetContainerFilesUseCase
    ) {
        super();
    }
}
