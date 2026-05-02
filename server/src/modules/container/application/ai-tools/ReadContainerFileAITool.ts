import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ReadContainerFileAITool extends AITool {
    readonly name = 'read_container_file';
    readonly description = 'Read a file from a container.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string() });

    constructor(
        protected readonly useCase: ReadContainerFileUseCase
    ) {
        super();
    }
}
