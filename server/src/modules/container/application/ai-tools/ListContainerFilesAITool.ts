import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';

@injectable()
export class ListContainerFilesAITool extends AITool {
    readonly name = 'list_container_files';
    readonly description = 'List files in a container directory.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string().optional().default('/') });

    constructor(
        @inject(GetContainerFilesUseCase)
        protected readonly useCase: GetContainerFilesUseCase
    ) {
        super();
    }
}
