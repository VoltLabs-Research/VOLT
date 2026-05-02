import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
