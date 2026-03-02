import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';

@injectable()
export class ReadContainerFileAITool extends AITool {
    readonly name = 'read_container_file';
    readonly description = 'Read a file from a container.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string() });

    constructor(
        @inject(ReadContainerFileUseCase)
        protected readonly useCase: ReadContainerFileUseCase
    ) {
        super();
    }
}
